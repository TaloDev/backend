import { EntityManager } from '@mikro-orm/mysql'
import { IntegrationType } from '../../../src/entities/integration'
import { GetSchemaForGameResponse, GetUserStatsForGameResponse, syncSteamworksStats } from '../../../src/lib/integrations/steamworks-integration'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../fixtures/IntegrationFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import SteamworksIntegrationEvent from '../../../src/entities/steamworks-integration-event'
import GameStat from '../../../src/entities/game-stat'
import GameStatFactory from '../../fixtures/GameStatFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import PlayerGameStat from '../../../src/entities/player-game-stat'
import PlayerGameStatFactory from '../../fixtures/PlayerGameStatFactory'
import { randSlug, randText } from '@ngneat/falso'

describe('Steamworks integration - sync stats', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  it('should pull in stats from steamworks', async () => {
    const [, game] = await createOrganisationAndGame()

    const statDisplayName = randText()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>global.em).persistAndFlush(integration)

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [200, {
      game: {
        gameName: game.name,
        gameVersion: '22',
        availableGameStats: {
          stats: [
            {
              name: 'stat_' + randSlug(),
              defaultvalue: 500,
              displayName: statDisplayName
            }
          ],
          achievements: []
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getSchemaMock)

    await syncSteamworksStats((<EntityManager>global.em), integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)

    const event = await (<EntityManager>global.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      body: '',
      method: 'GET'
    })

    const createdStat = await (<EntityManager>global.em).getRepository(GameStat).findOne({
      game: integration.game,
      name: statDisplayName,
      globalValue: 500,
      defaultValue: 500,
      minTimeBetweenUpdates: 10,
      global: false
    })

    expect(createdStat).toBeTruthy()
  })

  it('should update existing stats with the name and default value from steamworks', async () => {
    const [, game] = await createOrganisationAndGame()

    const statName = 'stat_' + randSlug()
    const statDisplayName = randText()

    const stat = await new GameStatFactory([game]).state(() => ({ internalName: statName })).one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()

    await (<EntityManager>global.em).persistAndFlush([stat, integration])

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [200, {
      game: {
        gameName: game.name,
        gameVersion: '22',
        availableGameStats: {
          stats: [
            {
              name: statName,
              defaultvalue: 500,
              displayName: statDisplayName
            }
          ],
          achievements: []
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getSchemaMock)

    await syncSteamworksStats((<EntityManager>global.em), integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)

    await (<EntityManager>global.em).refresh(stat)
    expect(stat.name).toBe(statDisplayName)
    expect(stat.defaultValue).toBe(500)
  })

  it('should pull in player stats from steamworks', async () => {
    const [, game] = await createOrganisationAndGame()

    const statName = 'stat_' + randSlug()

    const player = await new PlayerFactory([game]).withSteamAlias().one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()

    await (<EntityManager>global.em).persistAndFlush([player, integration])

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [200, {
      game: {
        gameName: game.name,
        gameVersion: '22',
        availableGameStats: {
          stats: [
            {
              name: statName,
              defaultvalue: 500,
              displayName: randText()
            }
          ],
          achievements: []
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getSchemaMock)

    const getUserStatsMock = vi.fn((): [number, GetUserStatsForGameResponse] => [200, {
      playerstats: {
        steamID: player.aliases[0].identifier,
        gameName: game.name,
        stats: [{
          name: statName,
          value: 301
        }],
        achievements: []
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`).replyOnce(getUserStatsMock)

    await syncSteamworksStats((<EntityManager>global.em), integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock).toHaveBeenCalledTimes(1)

    const playerStat = await (<EntityManager>global.em).getRepository(PlayerGameStat).findOne({ value: 301 })
    expect(playerStat).toBeTruthy()
  })

  it('should not pull in player stats for players that do not exist in steamworks', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).withSteamAlias().one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()

    await (<EntityManager>global.em).persistAndFlush([player, integration])

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [200, {
      game: {
        gameName: game.name,
        gameVersion: '22',
        availableGameStats: {
          stats: [
            {
              name: 'stat_' + randSlug(),
              defaultvalue: 500,
              displayName: randText()
            }
          ],
          achievements: []
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getSchemaMock)

    const getUserStatsMock = vi.fn((): [number] => [400])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`).replyOnce(getUserStatsMock)

    await syncSteamworksStats((<EntityManager>global.em), integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock).toHaveBeenCalledTimes(1)

    const playerStat = await (<EntityManager>global.em).getRepository(PlayerGameStat).findOne({ player })
    expect(playerStat).toBeNull()
  })

  it('should update player stats with the ones from steamworks', async () => {
    const [, game] = await createOrganisationAndGame()

    const statName = 'stat_' + randSlug()

    const player = await new PlayerFactory([game]).withSteamAlias().one()
    const stat = await new GameStatFactory([game]).state(() => ({ internalName: statName })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 288 })).one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()

    await (<EntityManager>global.em).persistAndFlush([player, playerStat, integration])

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [200, {
      game: {
        gameName: game.name,
        gameVersion: '22',
        availableGameStats: {
          stats: [
            {
              name: statName,
              defaultvalue: 500,
              displayName: randText()
            }
          ],
          achievements: []
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getSchemaMock)

    const getUserStatsMock = vi.fn((): [number, GetUserStatsForGameResponse] => [200, {
      playerstats: {
        steamID: player.aliases[0].identifier,
        gameName: game.name,
        stats: [{
          name: statName,
          value: 301
        }],
        achievements: []
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`).replyOnce(getUserStatsMock)

    await syncSteamworksStats((<EntityManager>global.em), integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock).toHaveBeenCalledTimes(1)

    expect(playerStat.value).toBe(301)
  })

  it('should push through player stats that only exist in talo', async () => {
    const [, game] = await createOrganisationAndGame()

    const statName = 'stat_' + randSlug()

    const player = await new PlayerFactory([game]).withSteamAlias().one()
    const stat = await new GameStatFactory([game]).state(() => ({ internalName: statName })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 54 })).one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()

    await (<EntityManager>global.em).persistAndFlush([player, playerStat, integration])

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [200, {
      game: {
        gameName: game.name,
        gameVersion: '22',
        availableGameStats: {
          stats: [
            {
              name: statName,
              defaultvalue: 500,
              displayName: randText()
            }
          ],
          achievements: []
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getSchemaMock)

    const getUserStatsMock = vi.fn((): [number, GetUserStatsForGameResponse] => [200, {
      playerstats: {
        steamID: player.aliases[0].identifier,
        gameName: game.name,
        stats: [],
        achievements: []
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`).replyOnce(getUserStatsMock)

    const setMock = vi.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1').replyOnce(setMock)

    await syncSteamworksStats((<EntityManager>global.em), integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock).toHaveBeenCalledTimes(1)
    expect(setMock).toHaveBeenCalledTimes(1)

    const event = await (<EntityManager>global.em).getRepository(SteamworksIntegrationEvent).findOne({ integration }, { orderBy: { id: 'DESC' } })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1',
      body: `appid=${config.appId}&steamid=${player.aliases[0].identifier}&count=1&name%5B0%5D=${stat.internalName}&value%5B0%5D=${playerStat.value}`,
      method: 'POST'
    })
  })
})
