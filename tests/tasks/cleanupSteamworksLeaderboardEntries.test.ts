import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import Integration, { IntegrationType } from '../../src/entities/integration.js'
import SteamworksIntegrationEvent from '../../src/entities/steamworks-integration-event.js'
import { SteamworksLeaderboardEntry } from '../../src/entities/steamworks-leaderboard-entry.js'
import SteamworksLeaderboardMapping from '../../src/entities/steamworks-leaderboard-mapping.js'
import cleanupSteamworksLeaderboardEntries from '../../src/tasks/cleanupSteamworksLeaderboardEntries.js'
import IntegrationConfigFactory from '../fixtures/IntegrationConfigFactory.js'
import IntegrationFactory from '../fixtures/IntegrationFactory.js'
import LeaderboardEntryFactory from '../fixtures/LeaderboardEntryFactory.js'
import LeaderboardFactory from '../fixtures/LeaderboardFactory.js'
import PlayerFactory from '../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../utils/createOrganisationAndGame.js'

describe('cleanupSteamworksLeaderboardEntries', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  const deleteMock = vi.fn(() => [
    200,
    {
      result: {
        result: 1,
      },
    },
  ])

  beforeAll(async () => {
    await global.em.repo(SteamworksLeaderboardEntry).nativeDelete({})
  })

  beforeEach(() => {
    axiosMock
      .onPost('https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboardScore/v1')
      .reply(deleteMock)
  })

  afterEach(async () => {
    axiosMock.reset()
    deleteMock.mockReset()
    vi.restoreAllMocks()
    // these tests run globally, not per-game
    await em.repo(SteamworksLeaderboardEntry).nativeDelete({})
  })

  it('should cleanup steamworks leaderboard entries with null leaderboard entries', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ unique: false })).one()
    const steamworksLeaderboard = new SteamworksLeaderboardMapping({
      steamworksLeaderboardId: 12345,
      leaderboard,
      integration,
    })

    const players = await new PlayerFactory([game]).many(10)
    const entries = await Promise.all(
      players.map(async (player) => {
        return new SteamworksLeaderboardEntry({
          steamworksLeaderboard,
          leaderboardEntry: await new LeaderboardEntryFactory(leaderboard, [player]).one(),
          steamUserId: player.aliases[0].identifier,
        })
      }),
    )

    entries[0].leaderboardEntry = null
    entries[1].leaderboardEntry = null
    entries[2].leaderboardEntry = null
    await em.persist([integration, ...entries]).flush()

    await cleanupSteamworksLeaderboardEntries()

    expect(deleteMock).toHaveBeenCalledTimes(3)

    const eventCount = await em.repo(SteamworksIntegrationEvent).count({ integration })
    expect(eventCount).toBe(3)

    const entryCount = await em.repo(SteamworksLeaderboardEntry).count({
      steamworksLeaderboard: {
        leaderboard,
      },
    })
    expect(entryCount).toBe(7)
  })

  it('should carry on even if one entry fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error')
    vi.spyOn(Integration.prototype, 'cleanupSteamworksLeaderboardEntry').mockRejectedValueOnce(
      new Error(),
    )

    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ unique: false })).one()
    const steamworksLeaderboard = new SteamworksLeaderboardMapping({
      steamworksLeaderboardId: 12345,
      leaderboard,
      integration,
    })

    const players = await new PlayerFactory([game]).many(5)
    const entries = players.map((player) => {
      return new SteamworksLeaderboardEntry({
        steamworksLeaderboard,
        leaderboardEntry: null,
        steamUserId: player.aliases[0].identifier,
      })
    })

    await em.persist([integration, ...entries]).flush()

    await cleanupSteamworksLeaderboardEntries()
    expect(consoleSpy).toHaveBeenCalled()

    expect(deleteMock).toHaveBeenCalledTimes(4)

    const eventCount = await em.repo(SteamworksIntegrationEvent).count({ integration })
    expect(eventCount).toBe(4)

    const entryCount = await em.repo(SteamworksLeaderboardEntry).count()
    expect(entryCount).toBe(1)
  })

  it('should cleanup leaderboard entries via their own integration', async () => {
    const [, game] = await createOrganisationAndGame()
    const integrationA = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, await new IntegrationConfigFactory().one())
      .one()
    const configA = integrationA.getSteamConfig()
    const integrationB = await new IntegrationFactory()
      .construct(
        IntegrationType.STEAMWORKS,
        game,
        await new IntegrationConfigFactory().state(() => ({ appId: configA.appId! + 1 })).one(),
      )
      .one()

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ unique: false })).one()
    const mappingA = new SteamworksLeaderboardMapping({
      steamworksLeaderboardId: 12345,
      leaderboard,
      integration: integrationA,
    })
    const mappingB = new SteamworksLeaderboardMapping({
      steamworksLeaderboardId: 54321,
      leaderboard,
      integration: integrationB,
    })

    const [playerA, playerB] = await new PlayerFactory([game]).many(2)
    const entryA = new SteamworksLeaderboardEntry({
      steamworksLeaderboard: mappingA,
      leaderboardEntry: null,
      steamUserId: playerA.aliases[0].identifier,
    })
    const entryB = new SteamworksLeaderboardEntry({
      steamworksLeaderboard: mappingB,
      leaderboardEntry: null,
      steamUserId: playerB.aliases[0].identifier,
    })

    await em.persist([integrationA, integrationB, mappingA, mappingB, entryA, entryB]).flush()

    await cleanupSteamworksLeaderboardEntries()

    expect(deleteMock).toHaveBeenCalledTimes(2)

    expect(await em.repo(SteamworksIntegrationEvent).count({ integration: integrationA })).toBe(1)
    expect(await em.repo(SteamworksIntegrationEvent).count({ integration: integrationB })).toBe(1)

    const entryCount = await em.repo(SteamworksLeaderboardEntry).count()
    expect(entryCount).toBe(0)
  })
})
