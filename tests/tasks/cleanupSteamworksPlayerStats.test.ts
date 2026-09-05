import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import Integration, { IntegrationType } from '../../src/entities/integration.js'
import SteamworksIntegrationEvent from '../../src/entities/steamworks-integration-event.js'
import { SteamworksPlayerStat } from '../../src/entities/steamworks-player-stat.js'
import cleanupSteamworksPlayerStats from '../../src/tasks/cleanupSteamworksPlayerStats.js'
import GameStatFactory from '../fixtures/GameStatFactory.js'
import IntegrationConfigFactory from '../fixtures/IntegrationConfigFactory.js'
import IntegrationFactory from '../fixtures/IntegrationFactory.js'
import PlayerFactory from '../fixtures/PlayerFactory.js'
import PlayerGameStatFactory from '../fixtures/PlayerGameStatFactory.js'
import createOrganisationAndGame from '../utils/createOrganisationAndGame.js'

describe('cleanupSteamworksPlayerStats', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  const setMock = vi.fn(() => [
    200,
    {
      result: {
        result: 1,
      },
    },
  ])
  axiosMock
    .onPost('https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1')
    .reply(setMock)

  beforeEach(async () => {
    setMock.mockReset()
    // these tests run globally, not per-game
    await em.repo(SteamworksPlayerStat).nativeDelete({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should cleanup steamworks player stats with null player stats', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    const stat = await new GameStatFactory([game]).one()
    const players = await new PlayerFactory([game]).withSteamAlias().many(10)

    const playerStats = await Promise.all(
      players.map(async (player) => {
        return new SteamworksPlayerStat({
          stat,
          integration,
          playerStat: await new PlayerGameStatFactory().construct(player, stat).one(),
          steamUserId: player.aliases[0].identifier,
        })
      }),
    )

    playerStats[0].playerStat = null
    playerStats[1].playerStat = null
    playerStats[2].playerStat = null
    await em.persist([integration, ...playerStats]).flush()

    await cleanupSteamworksPlayerStats()

    expect(setMock).toHaveBeenCalledTimes(3)

    const eventCount = await em.repo(SteamworksIntegrationEvent).count({ integration })
    expect(eventCount).toBe(3)

    const playerStatCount = await em.repo(SteamworksPlayerStat).count()
    expect(playerStatCount).toBe(7)
  })

  it('should carry on even if one player stat cleanup fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error')
    vi.spyOn(Integration.prototype, 'cleanupSteamworksPlayerStat').mockRejectedValueOnce(
      new Error(),
    )

    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    const stat = await new GameStatFactory([game]).one()
    const players = await new PlayerFactory([game]).withSteamAlias().many(5)

    const playerStats = players.map((player) => {
      return new SteamworksPlayerStat({
        stat,
        integration,
        playerStat: null,
        steamUserId: player.aliases[0].identifier,
      })
    })

    await em.persist([integration, ...playerStats]).flush()

    await cleanupSteamworksPlayerStats()
    expect(consoleSpy).toHaveBeenCalled()

    expect(setMock).toHaveBeenCalledTimes(4)

    const eventCount = await em.repo(SteamworksIntegrationEvent).count({ integration })
    expect(eventCount).toBe(4)

    const playerStatCount = await em.repo(SteamworksPlayerStat).count()
    expect(playerStatCount).toBe(1)
  })

  it('should set stats to default values when cleaning up', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    const stat = await new GameStatFactory([game]).state(() => ({ defaultValue: 100 })).one()
    const player = await new PlayerFactory([game]).withSteamAlias().one()

    const playerStat = new SteamworksPlayerStat({
      stat,
      integration,
      playerStat: null,
      steamUserId: player.aliases[0].identifier,
    })

    await em.persist([integration, playerStat]).flush()

    await cleanupSteamworksPlayerStats()

    expect(setMock).toHaveBeenCalledTimes(1)

    const event = await em.repo(SteamworksIntegrationEvent).findOneOrFail({ integration })
    expect(event.request.body).toContain(`value%5B0%5D=${stat.defaultValue}`)
    expect(event.request.body).toContain(`name%5B0%5D=${stat.internalName}`)
    expect(event.request.body).toContain(`steamid=${player.aliases[0].identifier}`)

    const playerStatCount = await em.repo(SteamworksPlayerStat).count()
    expect(playerStatCount).toBe(0)
  })

  it('should only cleanup steamworks player stats with null player stats', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    const stat = await new GameStatFactory([game]).one()
    const players = await new PlayerFactory([game]).withSteamAlias().many(5)

    const playerStats = await Promise.all(
      players.map(async (player) => {
        return new SteamworksPlayerStat({
          stat,
          integration,
          playerStat: await new PlayerGameStatFactory().construct(player, stat).one(),
          steamUserId: player.aliases[0].identifier,
        })
      }),
    )

    playerStats[0].playerStat = null
    playerStats[1].playerStat = null

    await em.persist([integration, ...playerStats]).flush()

    await cleanupSteamworksPlayerStats()

    expect(setMock).toHaveBeenCalledTimes(2)

    const eventCount = await em.repo(SteamworksIntegrationEvent).count({ integration })
    expect(eventCount).toBe(2)

    const playerStatCount = await em.repo(SteamworksPlayerStat).count()
    expect(playerStatCount).toBe(3)
  })

  it('should cleanup player stats via their own integration', async () => {
    const [, game] = await createOrganisationAndGame()
    const configA = await new IntegrationConfigFactory().one()
    const integrationA = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, configA)
      .one()
    const configB = await new IntegrationConfigFactory()
      .state(() => ({ appId: configA.appId + 1 }))
      .one()
    const integrationB = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, configB)
      .one()

    const stat = await new GameStatFactory([game]).one()
    const [playerA, playerB] = await new PlayerFactory([game]).withSteamAlias().many(2)

    const statA = new SteamworksPlayerStat({
      stat,
      integration: integrationA,
      playerStat: null,
      steamUserId: playerA.aliases[0].identifier,
    })
    const statB = new SteamworksPlayerStat({
      stat,
      integration: integrationB,
      playerStat: null,
      steamUserId: playerB.aliases[0].identifier,
    })

    await em.persist([integrationA, integrationB, statA, statB]).flush()

    await cleanupSteamworksPlayerStats()

    expect(setMock).toHaveBeenCalledTimes(2)

    expect(await em.repo(SteamworksIntegrationEvent).count({ integration: integrationA })).toBe(1)
    expect(await em.repo(SteamworksIntegrationEvent).count({ integration: integrationB })).toBe(1)

    // each row was reset against its own integration's app
    const events = await em.repo(SteamworksIntegrationEvent).findAll()
    const bodies = events.map((event) => event.request.body)
    expect(bodies).toContain(
      `appid=${configA.appId}&steamid=${playerA.aliases[0].identifier}&count=1&name%5B0%5D=${stat.internalName}&value%5B0%5D=${stat.defaultValue}`,
    )
    expect(bodies).toContain(
      `appid=${configB.appId}&steamid=${playerB.aliases[0].identifier}&count=1&name%5B0%5D=${stat.internalName}&value%5B0%5D=${stat.defaultValue}`,
    )
  })
})
