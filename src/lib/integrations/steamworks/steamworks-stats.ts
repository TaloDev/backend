import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import querystring from 'qs'
import GameStat from '../../../entities/game-stat'
import Integration from '../../../entities/integration'
import PlayerAlias, { PlayerAliasService } from '../../../entities/player-alias'
import PlayerGameStat from '../../../entities/player-game-stat'
import { SteamworksPlayerStat } from '../../../entities/steamworks-player-stat'
import { streamByCursor } from '../../perf/streamByCursor'
import {
  GetSchemaForGameResponse,
  GetUserStatsForGameResponse,
  SteamworksClient,
  SteamworksGameStat,
  SteamworksNetworkError,
} from '../clients/steamworks-client'

async function getSteamworksStatsForPlayer(
  em: EntityManager,
  integration: Integration,
  steamId: string,
) {
  const client = new SteamworksClient(integration)
  const { res, event } = await client.makeRequest<GetUserStatsForGameResponse>({
    method: 'GET',
    url: `/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${steamId}`,
  })
  await em.persist(event).flush()

  return res?.data
}

async function requestSetSteamworksUserStat({
  integration,
  stat,
  steamUserId,
  value,
}: {
  integration: Integration
  stat: GameStat
  steamUserId: string
  value: number
}) {
  const body = querystring.stringify({
    appid: integration.getConfig().appId,
    steamid: steamUserId,
    count: 1,
    name: [stat.internalName],
    value: [value],
  })

  const client = new SteamworksClient(integration)
  const { event, success } = await client.makeRequest({
    method: 'POST',
    url: '/ISteamUserStats/SetUserStatsForGame/v1',
    body,
  })
  return { event, success }
}

export async function setSteamworksStat(
  em: EntityManager,
  integration: Integration,
  playerStat: PlayerGameStat,
  playerAlias: PlayerAlias,
) {
  const { event, success } = await requestSetSteamworksUserStat({
    integration,
    stat: playerStat.stat,
    steamUserId: playerAlias.identifier,
    value: playerStat.value,
  })
  await em.persist(event).flush()

  if (!success) {
    throw new SteamworksNetworkError()
  }

  await em.upsert(
    new SteamworksPlayerStat({
      stat: playerStat.stat,
      playerStat,
      steamUserId: playerAlias.identifier,
    }),
  )
}

async function ingestSteamworksGameStats(
  em: EntityManager,
  integration: Integration,
  steamworksStats: SteamworksGameStat[],
) {
  for (const steamworksStat of steamworksStats) {
    try {
      const existingStat = await em
        .repo(GameStat)
        .findOne({ internalName: steamworksStat.name, game: integration.game })
      if (!existingStat) {
        const stat = new GameStat(integration.game)
        stat.internalName = steamworksStat.name
        stat.name = steamworksStat.displayName
        stat.globalValue = stat.defaultValue = steamworksStat.defaultvalue
        stat.minTimeBetweenUpdates = 10
        stat.global = false
        em.persist(stat)
      } else {
        existingStat.defaultValue = steamworksStat.defaultvalue
        existingStat.name = steamworksStat.displayName
      }
      await em.flush()
    } catch (err) {
      captureException(err)
    }
  }
}

async function ingestSteamworksPlayerStatForAlias(
  em: EntityManager,
  integration: Integration,
  alias: PlayerAlias,
) {
  const res = await getSteamworksStatsForPlayer(em, integration, alias.identifier)
  const steamworksPlayerStats = res?.playerstats?.stats ?? []
  const syncedIds: number[] = []

  for (const steamworksPlayerStat of steamworksPlayerStats) {
    try {
      const id = await em.transactional(async (trx) => {
        const stat = await trx
          .repo(GameStat)
          .findOneOrFail({ internalName: steamworksPlayerStat.name, game: integration.game })
        const existingPlayerStat = await trx.repo(PlayerGameStat).findOne({
          player: alias.player,
          stat,
        })

        if (existingPlayerStat) {
          existingPlayerStat.value = steamworksPlayerStat.value
          return existingPlayerStat.id
        } else {
          const playerStat = new PlayerGameStat(alias.player, stat)
          playerStat.value = steamworksPlayerStat.value
          trx.persist(playerStat)

          const steamsWorksPlayerStat = new SteamworksPlayerStat({
            stat,
            playerStat,
            steamUserId: alias.identifier,
          })
          trx.persist(steamsWorksPlayerStat)

          return playerStat.id
        }
      })
      syncedIds.push(id)
    } catch (err) {
      captureException(err)
    }
  }

  return syncedIds
}

async function ingestSteamworksPlayerStats(em: EntityManager, integration: Integration) {
  const aliasStream = streamByCursor<PlayerAlias>(async (batchSize, after) => {
    return em.repo(PlayerAlias).findByCursor(
      {
        service: PlayerAliasService.STEAM,
        player: {
          game: integration.game,
        },
      },
      {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
      },
    )
  }, 100)

  const syncedPlayerStatIds = new Set<number>()

  for await (const alias of aliasStream) {
    const syncedIds = await ingestSteamworksPlayerStatForAlias(em, integration, alias)
    for (const id of syncedIds) {
      syncedPlayerStatIds.add(id)
    }
  }

  return syncedPlayerStatIds
}

async function pushPlayerStatsToSteamworks({
  em,
  integration,
  steamworksStats,
  syncedPlayerStatIds,
}: {
  em: EntityManager
  integration: Integration
  steamworksStats: SteamworksGameStat[]
  syncedPlayerStatIds: Set<number>
}) {
  const playerStatStream = streamByCursor<PlayerGameStat>(async (batchSize, after) => {
    return em.repo(PlayerGameStat).findByCursor(
      {
        id: {
          $nin: Array.from(syncedPlayerStatIds),
        },
        player: {
          aliases: {
            $some: {
              service: PlayerAliasService.STEAM,
            },
          },
        },
        stat: {
          internalName: steamworksStats.map((steamworksStat) => steamworksStat.name),
        },
      },
      {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
        populate: ['player.aliases'] as const,
      },
    )
  }, 100)

  for await (const unsyncedPlayerStat of playerStatStream) {
    const steamAlias = unsyncedPlayerStat.player.aliases
      .getItems()
      .find((alias) => alias.service === PlayerAliasService.STEAM)
    if (steamAlias) {
      try {
        await setSteamworksStat(em, integration, unsyncedPlayerStat, steamAlias)
      } catch (err) {
        captureException(err)
      }
    }
  }
}

export async function syncSteamworksStats(em: EntityManager, integration: Integration) {
  const client = new SteamworksClient(integration)
  const { res, event } = await client.makeRequest<GetSchemaForGameResponse>({
    method: 'GET',
    url: `/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`,
  })
  await em.persist(event).flush()

  const steamworksStats = res?.data?.game?.availableGameStats?.stats
  if (!Array.isArray(steamworksStats)) {
    throw new Error('Failed to retrieve stats - is your App ID correct?')
  }

  await ingestSteamworksGameStats(em, integration, steamworksStats)

  const syncedPlayerStatIds = await ingestSteamworksPlayerStats(em, integration)

  // push through player stats that aren't in steamworks
  await pushPlayerStatsToSteamworks({
    em,
    integration,
    steamworksStats,
    syncedPlayerStatIds,
  })
}

export async function cleanupSteamworksPlayerStat(
  em: EntityManager,
  integration: Integration,
  steamworksPlayerStat: SteamworksPlayerStat,
) {
  // can't delete stats
  const { event } = await requestSetSteamworksUserStat({
    integration,
    stat: steamworksPlayerStat.stat,
    steamUserId: steamworksPlayerStat.steamUserId,
    value: steamworksPlayerStat.stat.defaultValue,
  })

  em.persist(event)
  em.remove(steamworksPlayerStat)
  await em.flush()
}
