import { randSlug, randText } from '@ngneat/falso'
import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import GameStat from '../../../src/entities/game-stat'
import { IntegrationType } from '../../../src/entities/integration'
import PlayerGameStat from '../../../src/entities/player-game-stat'
import SteamworksIntegrationEvent from '../../../src/entities/steamworks-integration-event'
import { SteamworksPlayerStat } from '../../../src/entities/steamworks-player-stat'
import {
  GetSchemaForGameResponse,
  GetUserStatsForGameResponse,
} from '../../../src/lib/integrations/clients/steamworks-client'
import { syncSteamworksStats } from '../../../src/lib/integrations/steamworks/steamworks-stats'
import GameStatFactory from '../../fixtures/GameStatFactory'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../fixtures/IntegrationFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import PlayerGameStatFactory from '../../fixtures/PlayerGameStatFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'

describe('Steamworks integration - sync stats', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterEach(() => {
    axiosMock.reset()
  })

  it('should pull in stats from steamworks', async () => {
    const [, game] = await createOrganisationAndGame()

    const statDisplayName = randText()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persistAndFlush(integration)

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [
      200,
      {
        game: {
          gameName: game.name,
          gameVersion: '22',
          availableGameStats: {
            stats: [
              {
                name: 'stat_' + randSlug(),
                defaultvalue: 500,
                displayName: statDisplayName,
              },
            ],
            achievements: [],
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      )
      .replyOnce(getSchemaMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)

    const event = await em.getRepository(SteamworksIntegrationEvent).findOneOrFail({ integration })
    expect(event.request).toStrictEqual({
      url: `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      body: '',
      method: 'GET',
    })

    const createdStat = await em.getRepository(GameStat).findOne({
      game: integration.game,
      name: statDisplayName,
      globalValue: 500,
      defaultValue: 500,
      minTimeBetweenUpdates: 10,
      global: false,
    })

    expect(createdStat).toBeTruthy()
  })

  it('should update existing stats with the name and default value from steamworks', async () => {
    const [, game] = await createOrganisationAndGame()

    const statName = 'stat_' + randSlug()
    const statDisplayName = randText()

    const stat = await new GameStatFactory([game]).state(() => ({ internalName: statName })).one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    await em.persistAndFlush([stat, integration])

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [
      200,
      {
        game: {
          gameName: game.name,
          gameVersion: '22',
          availableGameStats: {
            stats: [
              {
                name: statName,
                defaultvalue: 500,
                displayName: statDisplayName,
              },
            ],
            achievements: [],
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      )
      .replyOnce(getSchemaMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)

    await em.refresh(stat)
    expect(stat.name).toBe(statDisplayName)
    expect(stat.defaultValue).toBe(500)
  })

  it('should pull in player stats from steamworks', async () => {
    const [, game] = await createOrganisationAndGame()

    const statName = 'stat_' + randSlug()

    const player = await new PlayerFactory([game]).withSteamAlias().one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    await em.persistAndFlush([player, integration])

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [
      200,
      {
        game: {
          gameName: game.name,
          gameVersion: '22',
          availableGameStats: {
            stats: [
              {
                name: statName,
                defaultvalue: 500,
                displayName: randText(),
              },
            ],
            achievements: [],
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      )
      .replyOnce(getSchemaMock)

    const getUserStatsMock = vi.fn((): [number, GetUserStatsForGameResponse] => [
      200,
      {
        playerstats: {
          steamID: player.aliases[0].identifier,
          gameName: game.name,
          stats: [
            {
              name: statName,
              value: 301,
            },
          ],
          achievements: [],
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`,
      )
      .replyOnce(getUserStatsMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock).toHaveBeenCalledTimes(1)

    const playerStat = await em.getRepository(PlayerGameStat).findOne({ value: 301 })
    expect(playerStat).toBeTruthy()

    const steamworksEntry = await em.getRepository(SteamworksPlayerStat).findOne({ playerStat })
    expect(steamworksEntry).toBeTruthy()
  })

  it('should not pull in player stats for players that do not exist in steamworks', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).withSteamAlias().one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    await em.persistAndFlush([player, integration])

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [
      200,
      {
        game: {
          gameName: game.name,
          gameVersion: '22',
          availableGameStats: {
            stats: [
              {
                name: 'stat_' + randSlug(),
                defaultvalue: 500,
                displayName: randText(),
              },
            ],
            achievements: [],
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      )
      .replyOnce(getSchemaMock)

    const getUserStatsMock = vi.fn((): [number] => [400])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`,
      )
      .replyOnce(getUserStatsMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock).toHaveBeenCalledTimes(1)

    const playerStat = await em.getRepository(PlayerGameStat).findOne({ player })
    expect(playerStat).toBeNull()
  })

  it('should update player stats with the ones from steamworks', async () => {
    const [, game] = await createOrganisationAndGame()

    const statName = 'stat_' + randSlug()

    const player = await new PlayerFactory([game]).withSteamAlias().one()
    const stat = await new GameStatFactory([game]).state(() => ({ internalName: statName })).one()
    const playerStat = await new PlayerGameStatFactory()
      .construct(player, stat)
      .state(() => ({ value: 288 }))
      .one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    await em.persistAndFlush([player, playerStat, integration])

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [
      200,
      {
        game: {
          gameName: game.name,
          gameVersion: '22',
          availableGameStats: {
            stats: [
              {
                name: statName,
                defaultvalue: 500,
                displayName: randText(),
              },
            ],
            achievements: [],
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      )
      .replyOnce(getSchemaMock)

    const getUserStatsMock = vi.fn((): [number, GetUserStatsForGameResponse] => [
      200,
      {
        playerstats: {
          steamID: player.aliases[0].identifier,
          gameName: game.name,
          stats: [
            {
              name: statName,
              value: 301,
            },
          ],
          achievements: [],
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`,
      )
      .replyOnce(getUserStatsMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock).toHaveBeenCalledTimes(1)

    expect(playerStat.value).toBe(301)
  })

  it('should push through player stats that only exist in talo', async () => {
    const [, game] = await createOrganisationAndGame()

    const statName = 'stat_' + randSlug()

    const player = await new PlayerFactory([game]).withSteamAlias().one()
    const stat = await new GameStatFactory([game]).state(() => ({ internalName: statName })).one()
    const playerStat = await new PlayerGameStatFactory()
      .construct(player, stat)
      .state(() => ({ value: 54 }))
      .one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    await em.persistAndFlush([player, playerStat, integration])

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [
      200,
      {
        game: {
          gameName: game.name,
          gameVersion: '22',
          availableGameStats: {
            stats: [
              {
                name: statName,
                defaultvalue: 500,
                displayName: randText(),
              },
            ],
            achievements: [],
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      )
      .replyOnce(getSchemaMock)

    const getUserStatsMock = vi.fn((): [number, GetUserStatsForGameResponse] => [
      200,
      {
        playerstats: {
          steamID: player.aliases[0].identifier,
          gameName: game.name,
          stats: [],
          achievements: [],
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`,
      )
      .replyOnce(getUserStatsMock)

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
      .replyOnce(setMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock).toHaveBeenCalledTimes(1)
    expect(setMock).toHaveBeenCalledTimes(1)

    const event = await em
      .getRepository(SteamworksIntegrationEvent)
      .findOneOrFail({ integration }, { orderBy: { id: 'desc' } })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1',
      body: `appid=${config.appId}&steamid=${player.aliases[0].identifier}&count=1&name%5B0%5D=${stat.internalName}&value%5B0%5D=${playerStat.value}`,
      method: 'POST',
    })
  })

  it('should throw if the response stats are not an array', async () => {
    const [, game] = await createOrganisationAndGame()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persistAndFlush(integration)

    const getSchemaMock = vi.fn((): [number] => [404])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      )
      .replyOnce(getSchemaMock)

    try {
      await syncSteamworksStats(em, integration)
    } catch (err) {
      expect((err as Error).message).toBe('Failed to retrieve stats - is your App ID correct?')
    }

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
  })

  it('should continue to push through stats from talo into steamworks even if some fail', async () => {
    const [, game] = await createOrganisationAndGame()

    const statName = 'stat_' + randSlug()

    const players = await new PlayerFactory([game]).withSteamAlias().many(15)
    const stat = await new GameStatFactory([game]).state(() => ({ internalName: statName })).one()
    const playerStats = await Promise.all(
      players.map((player) => new PlayerGameStatFactory().construct(player, stat).one()),
    )

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    await em.persistAndFlush([stat, ...players, ...playerStats, integration])

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [
      200,
      {
        game: {
          gameName: game.name,
          gameVersion: '22',
          availableGameStats: {
            stats: [
              {
                name: statName,
                defaultvalue: 500,
                displayName: randText(),
              },
            ],
            achievements: [],
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      )
      .replyOnce(getSchemaMock)

    players.forEach((player) => {
      const getUserStatsMock = vi.fn((): [number, GetUserStatsForGameResponse] => [
        200,
        {
          playerstats: {
            steamID: player.aliases[0].identifier,
            gameName: game.name,
            stats: [],
            achievements: [],
          },
        },
      ])
      axiosMock
        .onGet(
          `https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`,
        )
        .replyOnce(getUserStatsMock)
    })

    const setMock = vi.fn(() => [
      200,
      {
        result: {
          result: 1,
        },
      },
    ])
    const url = 'https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1'
    axiosMock
      .onPost(url)
      .networkErrorOnce()
      .onPost(url)
      .networkErrorOnce() // retry 1
      .onPost(url)
      .networkErrorOnce() // retry 2
      .onPost(url)
      .reply(setMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(setMock).toHaveBeenCalledTimes(players.length - 1) // networkErrorOnce doesn't have a mock callback

    const steamworksStatCount = await em.getRepository(SteamworksPlayerStat).count({
      playerStat: {
        stat,
      },
    })
    expect(steamworksStatCount).toBe(players.length - 1) // 1 failed
  })

  it('should continue to push through stats from steamworks even if some fail', async () => {
    const [, game] = await createOrganisationAndGame()

    const statName = 'stat_' + randSlug()

    const players = await new PlayerFactory([game]).withSteamAlias().many(3)

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    await em.persistAndFlush([...players, integration])

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [
      200,
      {
        game: {
          gameName: game.name,
          gameVersion: '22',
          availableGameStats: {
            stats: [
              {
                name: statName,
                defaultvalue: 500,
                displayName: randText(),
              },
            ],
            achievements: [],
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      )
      .replyOnce(getSchemaMock)

    const getUserStatsMock1 = vi.fn((): [number, GetUserStatsForGameResponse] => [
      200,
      {
        playerstats: {
          steamID: players[0].aliases[0].identifier,
          gameName: game.name,
          stats: [
            {
              name: 'nonexistent_stat_' + randSlug(), // will cause findOneOrFail to throw
              value: 239,
            },
          ],
          achievements: [],
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${players[0].aliases[0].identifier}`,
      )
      .replyOnce(getUserStatsMock1)

    const getUserStatsMock2 = vi.fn((): [number, GetUserStatsForGameResponse] => [
      200,
      {
        playerstats: {
          steamID: players[1].aliases[0].identifier,
          gameName: game.name,
          stats: [
            {
              name: statName,
              value: 276,
            },
          ],
          achievements: [],
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${players[1].aliases[0].identifier}`,
      )
      .replyOnce(getUserStatsMock2)

    const getUserStatsMock3 = vi.fn((): [number, GetUserStatsForGameResponse] => [
      200,
      {
        playerstats: {
          steamID: players[2].aliases[0].identifier,
          gameName: game.name,
          stats: [
            {
              name: statName,
              value: 301,
            },
          ],
          achievements: [],
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${players[2].aliases[0].identifier}`,
      )
      .replyOnce(getUserStatsMock3)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock1).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock2).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock3).toHaveBeenCalledTimes(1)

    const playerStatCount = await em.getRepository(PlayerGameStat).count({
      stat: {
        game,
      },
    })
    expect(playerStatCount).toBe(2) // 1 failed

    const steamworksStatCount = await em.getRepository(SteamworksPlayerStat).count({
      playerStat: {
        stat: {
          game,
        },
      },
    })
    expect(steamworksStatCount).toBe(playerStatCount)
  })

  it('should pull in multiple player stats from steamworks for a single player', async () => {
    const [, game] = await createOrganisationAndGame()

    const statName1 = 'stat_' + randSlug()
    const statName2 = 'stat_' + randSlug()
    const statName3 = 'stat_' + randSlug()

    const player = await new PlayerFactory([game]).withSteamAlias().one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    await em.persistAndFlush([player, integration])

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [
      200,
      {
        game: {
          gameName: game.name,
          gameVersion: '22',
          availableGameStats: {
            stats: [
              { name: statName1, defaultvalue: 100, displayName: randText() },
              { name: statName2, defaultvalue: 200, displayName: randText() },
              { name: statName3, defaultvalue: 300, displayName: randText() },
            ],
            achievements: [],
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      )
      .replyOnce(getSchemaMock)

    const getUserStatsMock = vi.fn((): [number, GetUserStatsForGameResponse] => [
      200,
      {
        playerstats: {
          steamID: player.aliases[0].identifier,
          gameName: game.name,
          stats: [
            { name: statName1, value: 111 },
            { name: statName2, value: 222 },
            { name: statName3, value: 333 },
          ],
          achievements: [],
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${player.aliases[0].identifier}`,
      )
      .replyOnce(getUserStatsMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)
    expect(getUserStatsMock).toHaveBeenCalledTimes(1)

    const playerStats = await em.getRepository(PlayerGameStat).find({ player })
    expect(playerStats).toHaveLength(3)

    const values = playerStats.map((ps) => ps.value).sort((a, b) => a - b)
    expect(values).toStrictEqual([111, 222, 333])

    const steamworksStats = await em
      .getRepository(SteamworksPlayerStat)
      .find({ playerStat: { player } })
    expect(steamworksStats).toHaveLength(3)
  })

  it('should continue to ingest game stats from steamworks even if some fail', async () => {
    const [, game] = await createOrganisationAndGame()

    const validStatName1 = 'stat_' + randSlug()
    const validStatName2 = 'stat_' + randSlug()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    await em.persistAndFlush(integration)

    const getSchemaMock = vi.fn((): [number, GetSchemaForGameResponse] => [
      200,
      {
        game: {
          gameName: game.name,
          gameVersion: '22',
          availableGameStats: {
            stats: [
              {
                name: validStatName1,
                defaultvalue: 100,
                displayName: randText(),
              },
              {
                name: randText({ charCount: 512 }), // will cause a database column length error
                defaultvalue: 200,
                displayName: randText(),
              },
              {
                name: validStatName2,
                defaultvalue: 300,
                displayName: randText(),
              },
            ],
            achievements: [],
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
      )
      .replyOnce(getSchemaMock)

    await syncSteamworksStats(em, integration)

    expect(getSchemaMock).toHaveBeenCalledTimes(1)

    // Should have created 2 new stats (first and third), the second one failed due to column length
    const createdStats = await em
      .getRepository(GameStat)
      .find({ game }, { orderBy: { internalName: 'ASC' } })
    expect(createdStats).toHaveLength(2)

    const statNames = createdStats.map((stat) => stat.internalName).sort()
    expect(statNames).toContain(validStatName1)
    expect(statNames).toContain(validStatName2)
  })
})
