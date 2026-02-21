import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import Integration, { IntegrationType } from '../../src/entities/integration'
import SteamworksIntegrationEvent from '../../src/entities/steamworks-integration-event'
import { SteamworksPlayerStat } from '../../src/entities/steamworks-player-stat'
import cleanupSteamworksPlayerStats from '../../src/tasks/cleanupSteamworksPlayerStats'
import GameStatFactory from '../fixtures/GameStatFactory'
import IntegrationConfigFactory from '../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../fixtures/IntegrationFactory'
import PlayerFactory from '../fixtures/PlayerFactory'
import PlayerGameStatFactory from '../fixtures/PlayerGameStatFactory'
import createOrganisationAndGame from '../utils/createOrganisationAndGame'

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
          playerStat: await new PlayerGameStatFactory().construct(player, stat).one(),
          steamUserId: player.aliases[0].identifier,
        })
      }),
    )

    playerStats[0].playerStat = null
    playerStats[1].playerStat = null
    playerStats[2].playerStat = null
    await em.persistAndFlush([integration, ...playerStats])

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
        playerStat: null,
        steamUserId: player.aliases[0].identifier,
      })
    })

    await em.persistAndFlush([integration, ...playerStats])

    await cleanupSteamworksPlayerStats()
    expect(consoleSpy).toHaveBeenCalled()

    expect(setMock).toHaveBeenCalledTimes(4)

    const eventCount = await em.repo(SteamworksIntegrationEvent).count({ integration })
    expect(eventCount).toBe(4)

    const playerStatCount = await em.repo(SteamworksPlayerStat).count()
    expect(playerStatCount).toBe(1)
  })

  it('should still delete steamworks player stats for games without integrations', async () => {
    const [, game] = await createOrganisationAndGame()

    const stat = await new GameStatFactory([game]).one()
    const players = await new PlayerFactory([game]).withSteamAlias().many(5)

    const playerStats = players.map((player) => {
      return new SteamworksPlayerStat({
        stat,
        playerStat: null,
        steamUserId: player.aliases[0].identifier,
      })
    })

    await em.persistAndFlush(playerStats)

    await cleanupSteamworksPlayerStats()

    expect(setMock).toHaveBeenCalledTimes(0)

    const eventCount = await em.repo(SteamworksIntegrationEvent).count({ integration: { game } })
    expect(eventCount).toBe(0)

    const playerStatCount = await em.repo(SteamworksPlayerStat).count()
    expect(playerStatCount).toBe(0)
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
      playerStat: null,
      steamUserId: player.aliases[0].identifier,
    })

    await em.persistAndFlush([integration, playerStat])

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
          playerStat: await new PlayerGameStatFactory().construct(player, stat).one(),
          steamUserId: player.aliases[0].identifier,
        })
      }),
    )

    playerStats[0].playerStat = null
    playerStats[1].playerStat = null

    await em.persistAndFlush([integration, ...playerStats])

    await cleanupSteamworksPlayerStats()

    expect(setMock).toHaveBeenCalledTimes(2)

    const eventCount = await em.repo(SteamworksIntegrationEvent).count({ integration })
    expect(eventCount).toBe(2)

    const playerStatCount = await em.repo(SteamworksPlayerStat).count()
    expect(playerStatCount).toBe(3)
  })
})
