import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import Integration, { IntegrationType } from '../../src/entities/integration'
import SteamworksIntegrationEvent from '../../src/entities/steamworks-integration-event'
import { SteamworksLeaderboardEntry } from '../../src/entities/steamworks-leaderboard-entry'
import SteamworksLeaderboardMapping from '../../src/entities/steamworks-leaderboard-mapping'
import cleanupSteamworksLeaderboardEntries from '../../src/tasks/cleanupSteamworksLeaderboardEntries'
import IntegrationConfigFactory from '../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../fixtures/IntegrationFactory'
import LeaderboardEntryFactory from '../fixtures/LeaderboardEntryFactory'
import LeaderboardFactory from '../fixtures/LeaderboardFactory'
import PlayerFactory from '../fixtures/PlayerFactory'
import createOrganisationAndGame from '../utils/createOrganisationAndGame'

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
    const steamworksLeaderboard = new SteamworksLeaderboardMapping(12345, leaderboard)

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
    const steamworksLeaderboard = new SteamworksLeaderboardMapping(12345, leaderboard)

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

  it('should still delete steamworks leaderboard entries for games without integrations', async () => {
    const [, game] = await createOrganisationAndGame()

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ unique: false })).one()
    const steamworksLeaderboard = new SteamworksLeaderboardMapping(12345, leaderboard)

    const players = await new PlayerFactory([game]).many(5)
    const entries = await Promise.all(
      players.map(async (player) => {
        return new SteamworksLeaderboardEntry({
          steamworksLeaderboard,
          leaderboardEntry: null,
          steamUserId: player.aliases[0].identifier,
        })
      }),
    )
    await em.persist(entries).flush()

    await cleanupSteamworksLeaderboardEntries()

    expect(deleteMock).toHaveBeenCalledTimes(0)

    const eventCount = await em.repo(SteamworksIntegrationEvent).count({ integration: { game } })
    expect(eventCount).toBe(0)

    const entryCount = await em.repo(SteamworksLeaderboardEntry).count()
    expect(entryCount).toBe(0)
  })
})
