import { EntityManager, MikroORM } from '@mikro-orm/core'
import ormConfig from '../../../src/config/mikro-orm.config'
import { IntegrationType } from '../../../src/entities/integration'
import { GetSchemaForGameResponse, GetUserStatsForGameResponse, syncSteamworksStats } from '../../../src/lib/integrations/steamworks-integration'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../fixtures/IntegrationFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import SteamworksIntegrationEvent from '../../../src/entities/steamworks-integration-event'
import GameStat from '../../../src/entities/game-stat'
import clearEntities from '../../utils/clearEntities'
import GameStatFactory from '../../fixtures/GameStatFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import PlayerGameStat from '../../../src/entities/player-game-stat'
import PlayerGameStatFactory from '../../fixtures/PlayerGameStatFactory'

describe('Steamworks integration - sync stats', () => {
  let em: EntityManager
  const axiosMock = new AxiosMockAdapter(axios)

  beforeAll(async () => {
    const orm = await MikroORM.init(ormConfig)
    em = orm.em
  })

  beforeEach(async () => {
    await clearEntities(em, ['GameStat'])
  })

  afterAll(async () => {
    await em.getConnection().close()
  })

  it('should pull in stats from steamworks', async () => {
    const [, game] = await createOrganisationAndGame(em)

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush(integration)

    const getSchemaMock = jest.fn((): [number, GetSchemaForGameResponse] => [200, {
      game: {
        gameName: game.name,
        gameVersion: '22',
        availableGameStats: {
          stats: [
            {
              name: 'stat_rank',
              defaultvalue: 500,
              displayName: 'Rank'
            }
          ],
          achievements: []
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getSchemaMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)

    const event = await em.getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      body: '',
      method: 'GET'
    })

    const createdStat = await em.getRepository(GameStat).findOne({
      game: integration.game,
      name: 'Rank',
      globalValue: 500,
      defaultValue: 500,
      minTimeBetweenUpdates: 10,
      global: false
    })

    expect(createdStat).toBeTruthy()
  })

  it('should update existing stats with the name and default value from steamworks', async () => {
    const [, game] = await createOrganisationAndGame(em)

    const stat = await new GameStatFactory([game]).with(() => ({ internalName: 'stat_rank' })).one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()

    await em.persistAndFlush([stat, integration])

    const getSchemaMock = jest.fn((): [number, GetSchemaForGameResponse] => [200, {
      game: {
        gameName: game.name,
        gameVersion: '22',
        availableGameStats: {
          stats: [
            {
              name: 'stat_rank',
              defaultvalue: 500,
              displayName: 'Rank'
            }
          ],
          achievements: []
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getSchemaMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)

    const updatedStat = await em.getRepository(GameStat).findOne(stat.id, { refresh: true })
    expect(updatedStat.name).toBe('Rank')
    expect(updatedStat.defaultValue).toBe(500)
  })

  it('should pull in player stats from steamworks', async () => {
    const [, game] = await createOrganisationAndGame(em)

    const player = await new PlayerFactory([game]).state('with steam alias').one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()

    await em.persistAndFlush([player, integration])

    const getSchemaMock = jest.fn((): [number, GetSchemaForGameResponse] => [200, {
      game: {
        gameName: game.name,
        gameVersion: '22',
        availableGameStats: {
          stats: [
            {
              name: 'stat_rank',
              defaultvalue: 500,
              displayName: 'Rank'
            }
          ],
          achievements: []
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getSchemaMock)

    const getUserStatsMock = jest.fn((): [number, GetUserStatsForGameResponse] => [200, {
      playerstats: {
        steamID: player.aliases[0].identifier,
        gameName: game.name,
        stats: [{
          name: 'stat_rank',
          value: 301
        }],
        achievements: []
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`).replyOnce(getUserStatsMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock).toHaveBeenCalledTimes(1)

    const playerStat = await em.getRepository(PlayerGameStat).findOne({ value: 301 })
    expect(playerStat).toBeTruthy()
  })

  it('should not pull in player stats for players that do not exist in steamworks', async () => {
    const [, game] = await createOrganisationAndGame(em)

    const player = await new PlayerFactory([game]).state('with steam alias').one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()

    await em.persistAndFlush([player, integration])

    const getSchemaMock = jest.fn((): [number, GetSchemaForGameResponse] => [200, {
      game: {
        gameName: game.name,
        gameVersion: '22',
        availableGameStats: {
          stats: [
            {
              name: 'stat_rank',
              defaultvalue: 500,
              displayName: 'Rank'
            }
          ],
          achievements: []
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getSchemaMock)

    const getUserStatsMock = jest.fn((): [number] => [400])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`).replyOnce(getUserStatsMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock).toHaveBeenCalledTimes(1)

    const playerStat = await em.getRepository(PlayerGameStat).findOne({ player })
    expect(playerStat).toBeNull()
  })

  it('should update player stats with the ones from steamworks', async () => {
    const [, game] = await createOrganisationAndGame(em)

    const player = await new PlayerFactory([game]).state('with steam alias').one()
    const stat = await new GameStatFactory([game]).with(() => ({ internalName: 'stat_rank' })).one()
    let playerStat = await new PlayerGameStatFactory().construct(player, stat).with(() => ({ value: 288 })).one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()

    await em.persistAndFlush([player, playerStat, integration])

    const getSchemaMock = jest.fn((): [number, GetSchemaForGameResponse] => [200, {
      game: {
        gameName: game.name,
        gameVersion: '22',
        availableGameStats: {
          stats: [
            {
              name: 'stat_rank',
              defaultvalue: 500,
              displayName: 'Rank'
            }
          ],
          achievements: []
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getSchemaMock)

    const getUserStatsMock = jest.fn((): [number, GetUserStatsForGameResponse] => [200, {
      playerstats: {
        steamID: player.aliases[0].identifier,
        gameName: game.name,
        stats: [{
          name: 'stat_rank',
          value: 301
        }],
        achievements: []
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`).replyOnce(getUserStatsMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock).toHaveBeenCalledTimes(1)

    playerStat = await em.getRepository(PlayerGameStat).findOne({ player }, { refresh: true })
    expect(playerStat.value).toBe(301)
  })

  it('should push through player stats that only exist in talo', async () => {
    const [, game] = await createOrganisationAndGame(em)

    const player = await new PlayerFactory([game]).state('with steam alias').one()
    const stat = await new GameStatFactory([game]).with(() => ({ internalName: 'stat_rank' })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).with(() => ({ value: 54 })).one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()

    await em.persistAndFlush([player, playerStat, integration])

    const getSchemaMock = jest.fn((): [number, GetSchemaForGameResponse] => [200, {
      game: {
        gameName: game.name,
        gameVersion: '22',
        availableGameStats: {
          stats: [
            {
              name: 'stat_rank',
              defaultvalue: 500,
              displayName: 'Rank'
            }
          ],
          achievements: []
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getSchemaMock)

    const getUserStatsMock = jest.fn((): [number, GetUserStatsForGameResponse] => [200, {
      playerstats: {
        steamID: player.aliases[0].identifier,
        gameName: game.name,
        stats: [],
        achievements: []
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`).replyOnce(getUserStatsMock)

    const setMock = jest.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1').replyOnce(setMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock).toHaveBeenCalledTimes(1)
    expect(setMock).toHaveBeenCalledTimes(1)

    const event = await em.getRepository(SteamworksIntegrationEvent).findOne({ integration }, { orderBy: { id: 'DESC' } })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1',
      body: `appid=${config.appId}&steamid=${player.aliases[0].identifier}&count=1&name%5B0%5D=${stat.internalName}&value%5B0%5D=${playerStat.value}`,
      method: 'POST'
    })
  })
})