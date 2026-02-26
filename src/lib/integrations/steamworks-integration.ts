import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import assert from 'node:assert'
import querystring from 'qs'
import GameStat from '../../entities/game-stat'
import Integration from '../../entities/integration'
import Leaderboard, { LeaderboardSortMode } from '../../entities/leaderboard'
import LeaderboardEntry from '../../entities/leaderboard-entry'
import Player from '../../entities/player'
import PlayerAlias, { PlayerAliasService } from '../../entities/player-alias'
import PlayerGameStat from '../../entities/player-game-stat'
import { SteamworksLeaderboardEntry } from '../../entities/steamworks-leaderboard-entry'
import SteamworksLeaderboardMapping from '../../entities/steamworks-leaderboard-mapping'
import { SteamworksPlayerStat } from '../../entities/steamworks-player-stat'
import { getResultCacheOptions } from '../perf/getResultCacheOptions'
import { streamByCursor } from '../perf/streamByCursor'
import {
  AuthenticateUserTicketResponse,
  CheckAppOwnershipResponse,
  FindOrCreateLeaderboardResponse,
  GetLeaderboardEntriesResponse,
  GetLeaderboardEntriesResponseEntry,
  GetLeaderboardsForGameResponse,
  GetLeaderboardsForGameResponseLeaderboard,
  GetPlayerSummariesResponse,
  GetSchemaForGameResponse,
  GetUserStatsForGameResponse,
  SteamworksClient,
  SteamworksGameStat,
  SteamworksNetworkError,
} from './clients/steamworks-client'

type CombinedLeaderboards = [
  Leaderboard,
  GetLeaderboardsForGameResponseLeaderboard | null,
  SteamworksLeaderboardMapping | null,
]

export async function createSteamworksLeaderboard(
  em: EntityManager,
  integration: Integration,
  leaderboard: Leaderboard,
) {
  const body = querystring.stringify({
    appid: integration.getConfig().appId,
    name: leaderboard.internalName,
    sortmethod: leaderboard.sortMode === LeaderboardSortMode.ASC ? 'Ascending' : 'Descending',
    displaytype: 'Numeric',
    createifnotfound: true,
    onlytrustedwrites: true,
    onlyfriendsreads: false,
  })

  const client = new SteamworksClient(integration)
  const { res, event } = await client.makeRequest<FindOrCreateLeaderboardResponse>({
    method: 'POST',
    url: '/ISteamLeaderboards/FindOrCreateLeaderboard/v2',
    body,
  })
  await em.persist(event).flush()

  const steamworksLeaderboard = res.data?.result?.leaderboard
  if (steamworksLeaderboard) {
    await em.repo(SteamworksLeaderboardMapping).upsert({
      steamworksLeaderboardId: steamworksLeaderboard.leaderBoardID,
      leaderboard,
      createdAt: new Date(),
    })
  }
}

export async function deleteSteamworksLeaderboard(
  em: EntityManager,
  integration: Integration,
  leaderboardInternalName: string,
) {
  const body = querystring.stringify({
    appid: integration.getConfig().appId,
    name: leaderboardInternalName,
  })

  const client = new SteamworksClient(integration)
  const { event } = await client.makeRequest({
    method: 'POST',
    url: '/ISteamLeaderboards/DeleteLeaderboard/v1',
    body,
  })

  await em.persist(event).flush()
}

export async function createSteamworksLeaderboardEntry(
  em: EntityManager,
  integration: Integration,
  entry: LeaderboardEntry,
) {
  const leaderboardMapping = await em
    .repo(SteamworksLeaderboardMapping)
    .findOne({ leaderboard: entry.leaderboard })

  if (leaderboardMapping) {
    const body = querystring.stringify({
      appid: integration.getConfig().appId,
      leaderboardid: leaderboardMapping.steamworksLeaderboardId,
      steamid: entry.playerAlias.identifier,
      score: entry.score,
      scoremethod: 'KeepBest',
    })

    const client = new SteamworksClient(integration)
    try {
      const { event } = await client.makeRequest({
        method: 'POST',
        url: '/ISteamLeaderboards/SetLeaderboardScore/v1',
        body,
      })
      await em.persist(event).flush()
    } catch (err) {
      if (err instanceof SteamworksNetworkError) {
        await em.persist(err.event).flush()
      }
      throw err
    }

    await em.upsert(
      new SteamworksLeaderboardEntry({
        steamworksLeaderboard: leaderboardMapping,
        leaderboardEntry: entry,
        steamUserId: entry.playerAlias.identifier,
      }),
    )
  }
}

async function requestDeleteLeaderboardScore({
  integration,
  steamworksLeaderboardId,
  steamUserId,
}: {
  integration: Integration
  steamworksLeaderboardId: number
  steamUserId: string
}) {
  const body = querystring.stringify({
    appid: integration.getConfig().appId,
    leaderboardid: steamworksLeaderboardId,
    steamid: steamUserId,
  })

  const client = new SteamworksClient(integration)
  const { event } = await client.makeRequest({
    method: 'POST',
    url: '/ISteamLeaderboards/DeleteLeaderboardScore/v1',
    body,
  })
  return event
}

export async function deleteSteamworksLeaderboardEntry(
  em: EntityManager,
  integration: Integration,
  entry: LeaderboardEntry,
) {
  const leaderboardMapping = await em
    .repo(SteamworksLeaderboardMapping)
    .findOne({ leaderboard: entry.leaderboard })

  if (leaderboardMapping) {
    const event = await requestDeleteLeaderboardScore({
      integration,
      steamworksLeaderboardId: leaderboardMapping.steamworksLeaderboardId,
      steamUserId: entry.playerAlias.identifier,
    })

    await em.persist(event).flush()
    await em.repo(SteamworksLeaderboardEntry).nativeDelete({
      steamworksLeaderboard: leaderboardMapping,
      leaderboardEntry: entry,
    })
  }
}

function mapSteamworksLeaderboardSortMode(sortMode: string) {
  return sortMode === 'Ascending' ? LeaderboardSortMode.ASC : LeaderboardSortMode.DESC
}

async function getEntriesForSteamworksLeaderboard(
  em: EntityManager,
  integration: Integration,
  leaderboardId: number,
) {
  const qs = querystring.stringify({
    appid: integration.getConfig().appId,
    leaderboardid: leaderboardId,
    rangestart: 0,
    rangeend: Number.MAX_VALUE,
    datarequest: 'RequestGlobal',
  })

  const client = new SteamworksClient(integration)
  const { res, event } = await client.makeRequest<GetLeaderboardEntriesResponse>({
    method: 'GET',
    url: `/ISteamLeaderboards/GetLeaderboardEntries/v1?${qs}`,
  })
  await em.persist(event).flush()

  return res.data
}

function createLeaderboardEntry({
  leaderboardMapping,
  playerAlias,
  score,
}: {
  leaderboardMapping: SteamworksLeaderboardMapping
  playerAlias: PlayerAlias
  score: number
}) {
  const entry = new LeaderboardEntry(leaderboardMapping.leaderboard)
  entry.playerAlias = playerAlias
  entry.score = score

  const steamworksEntry = new SteamworksLeaderboardEntry({
    steamworksLeaderboard: leaderboardMapping,
    leaderboardEntry: entry,
    steamUserId: playerAlias.identifier,
  })

  return steamworksEntry
}

async function matchAliasAndLeaderboardEntry({
  em,
  steamworksLeaderboard,
  steamEntryData,
}: {
  em: EntityManager
  steamworksLeaderboard: GetLeaderboardsForGameResponseLeaderboard
  steamEntryData: GetLeaderboardEntriesResponseEntry
}) {
  // this is a necessary evil for ensuring the identity map doesn't get corrupted between entry syncs
  const leaderboardMapping = await em.repo(SteamworksLeaderboardMapping).findOneOrFail(
    {
      steamworksLeaderboardId: steamworksLeaderboard.id,
    },
    {
      ...getResultCacheOptions(`sync-leaderboards-mapping-${steamworksLeaderboard.id}`),
      populate: ['leaderboard.game'],
    },
  )

  let playerAlias = await em.repo(PlayerAlias).findOne({
    service: PlayerAliasService.STEAM,
    identifier: steamEntryData.steamID,
    player: {
      game: leaderboardMapping.leaderboard.game,
    },
  })

  if (playerAlias) {
    const existingEntry = await em
      .repo(LeaderboardEntry)
      .findOne({ leaderboard: leaderboardMapping.leaderboard, playerAlias })
    if (existingEntry) {
      existingEntry.score = steamEntryData.score
      await em.flush()
      return { newEntry: undefined, updated: true }
    }
  } else {
    // if the alias doesnt exist then neither does the entry, so create both
    const player = new Player(leaderboardMapping.leaderboard.game)
    player.addProp('importedFromSteam', new Date().toISOString())
    playerAlias = new PlayerAlias()
    playerAlias.player = player
    playerAlias.service = PlayerAliasService.STEAM
    playerAlias.identifier = steamEntryData.steamID
  }

  const newEntry = createLeaderboardEntry({
    leaderboardMapping,
    playerAlias,
    score: steamEntryData.score,
  })
  await em.persist(newEntry).flush()

  return { newEntry: newEntry.leaderboardEntry, updated: false }
}

async function ingestEntriesFromSteamworks({
  em,
  integration,
  steamworksLeaderboard,
}: {
  em: EntityManager
  integration: Integration
  steamworksLeaderboard: GetLeaderboardsForGameResponseLeaderboard
}) {
  const entriesRes = await getEntriesForSteamworksLeaderboard(
    em,
    integration,
    steamworksLeaderboard.id,
  )

  let processed = 0
  const syncedEntryIds = new Set<number>()

  for (const steamEntryData of entriesRes.leaderboardEntryInformation.leaderboardEntries) {
    try {
      const { newEntry, updated } = await matchAliasAndLeaderboardEntry({
        em: em.fork(),
        steamworksLeaderboard,
        steamEntryData,
      })

      if (newEntry) {
        syncedEntryIds.add(newEntry.id)
      }
      if (newEntry || updated) {
        processed++
      }
    } catch (err) {
      captureException(err)
    }
  }

  console.info(
    `Ingested ${processed} entries from Steamworks for leaderboard ${steamworksLeaderboard.name}`,
  )
  return syncedEntryIds
}

async function pushEntriesToSteamworks({
  em,
  leaderboard,
  integration,
  syncedEntryIds,
}: {
  em: EntityManager
  leaderboard: Leaderboard
  integration: Integration
  syncedEntryIds: Set<number>
}) {
  let processed = 0
  let pushed = 0

  const entryStream = streamByCursor<LeaderboardEntry>(async (batchSize, after) => {
    return em.repo(LeaderboardEntry).findByCursor(
      {
        leaderboard,
      },
      {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
      },
    )
  }, 10)

  for await (const entry of entryStream) {
    try {
      if (!syncedEntryIds.has(entry.id) && entry.playerAlias.service === PlayerAliasService.STEAM) {
        await createSteamworksLeaderboardEntry(em, integration, entry)
      }
      pushed++
    } catch (err) {
      captureException(err)
    } finally {
      processed++
      if (processed % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  console.info(`Pushed ${pushed} entries to Steamworks for leaderboard ${leaderboard.internalName}`)
}

export async function syncSteamworksLeaderboards(em: EntityManager, integration: Integration) {
  const client = new SteamworksClient(integration)
  const { res, event } = await client.makeRequest<GetLeaderboardsForGameResponse>({
    method: 'GET',
    url: `/ISteamLeaderboards/GetLeaderboardsForGame/v2?appid=${integration.getConfig().appId}`,
  })
  await em.persist(event).flush()

  const steamworksLeaderboards = res.data?.response?.leaderboards
  if (!Array.isArray(steamworksLeaderboards)) {
    throw new Error('Failed to retrieve leaderboards - is your App ID correct?')
  }

  const leaderboards = await em.repo(Leaderboard).find({ game: integration.game })

  const combinedLeaderboards = await Promise.all(
    leaderboards.map(async (leaderboard): Promise<CombinedLeaderboards> => {
      const leaderboardMapping = await em
        .repo(SteamworksLeaderboardMapping)
        .findOne({ leaderboard })

      const mappingMatch = steamworksLeaderboards.find(
        (steamworksLeaderboard) =>
          steamworksLeaderboard.id === leaderboardMapping?.steamworksLeaderboardId,
      )
      const nameMatch = steamworksLeaderboards.find(
        (steamworksLeaderboard) => steamworksLeaderboard.name === leaderboard.internalName,
      )

      return [leaderboard, mappingMatch ?? nameMatch ?? null, leaderboardMapping]
    }),
  )

  for (const [leaderboard, steamworksLeaderboard, leaderboardMapping] of combinedLeaderboards) {
    await em.transactional(async (trx) => {
      // update talo leaderboards with properties from steamworks - because we can't do the other way around
      if (leaderboard && steamworksLeaderboard) {
        if (!leaderboardMapping)
          trx.persist(new SteamworksLeaderboardMapping(steamworksLeaderboard.id, leaderboard))

        leaderboard.internalName = leaderboard.name = steamworksLeaderboard.name
        leaderboard.sortMode = mapSteamworksLeaderboardSortMode(steamworksLeaderboard.sortmethod)
        leaderboard.unique = true
        // create in steamworks if it only exists in Talo
      } else if (leaderboard && !steamworksLeaderboard) {
        await createSteamworksLeaderboard(trx, integration, leaderboard)
      }
    })
  }

  // create leaderboards in talo for ones that only exist in steamworks
  const leaderboardsOnlyInSteamworks = steamworksLeaderboards.filter((steamworksLeaderboard) => {
    return !leaderboards.find(
      (leaderboard) => steamworksLeaderboard.name === leaderboard.internalName,
    )
  })
  for (const steamworksLeaderboard of leaderboardsOnlyInSteamworks) {
    await em.transactional((trx) => {
      const leaderboard = new Leaderboard(integration.game)
      leaderboard.internalName = leaderboard.name = steamworksLeaderboard.name
      leaderboard.sortMode = mapSteamworksLeaderboardSortMode(steamworksLeaderboard.sortmethod)
      leaderboard.unique = true

      trx.persist(new SteamworksLeaderboardMapping(steamworksLeaderboard.id, leaderboard))
      trx.persist(leaderboard)
      leaderboards.push(leaderboard)
    })
  }

  const syncedEntryIds = new Set<number>()

  // push entries from steam into talo
  for (const steamworksLeaderboard of steamworksLeaderboards) {
    const entryIds = await ingestEntriesFromSteamworks({
      em: em.fork(),
      integration,
      steamworksLeaderboard,
    })
    for (const entryId of entryIds) {
      syncedEntryIds.add(entryId)
    }
  }

  // push entries from talo into steam
  for (const leaderboard of leaderboards) {
    await pushEntriesToSteamworks({
      em: em.fork(),
      leaderboard,
      integration,
      syncedEntryIds,
    })
  }
}

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

  return res.data
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
  const { event } = await client.makeRequest({
    method: 'POST',
    url: '/ISteamUserStats/SetUserStatsForGame/v1',
    body,
  })
  return event
}

export async function setSteamworksStat(
  em: EntityManager,
  integration: Integration,
  playerStat: PlayerGameStat,
  playerAlias: PlayerAlias,
) {
  let event
  try {
    event = await requestSetSteamworksUserStat({
      integration,
      stat: playerStat.stat,
      steamUserId: playerAlias.identifier,
      value: playerStat.value,
    })
  } catch (err) {
    if (err instanceof SteamworksNetworkError) {
      await em.persist(err.event).flush()
    }
    throw err
  }
  await em.persist(event).flush()

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

  const steamworksStats = res.data?.game?.availableGameStats?.stats
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

async function requestAuthenticateUserTicket({
  em,
  integration,
  ticket,
  identity,
}: {
  em: EntityManager
  integration: Integration
  ticket: string
  identity?: string
}) {
  const client = new SteamworksClient(integration)
  const { res, event } = await client.makeRequest<AuthenticateUserTicketResponse>({
    method: 'GET',
    url: `/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${integration.getConfig().appId}&ticket=${ticket}${identity ? `&identity=${identity}` : ''}`,
  })
  await em.persist(event).flush()

  // set the cause to 400 so the api doesn't return a 500
  const errorOpts = { cause: 400 }

  if (res.status >= 500) {
    throw new Error(
      'Failed to authenticate Steamworks ticket: Steam service unavailable',
      errorOpts,
    )
  } else if (res.data?.response?.error) {
    const message = `Failed to authenticate Steamworks ticket: ${res.data.response.error.errordesc} (${res.data.response.error.errorcode})`
    throw new Error(message, errorOpts)
  } else if (res.status === 403) {
    throw new Error('Failed to authenticate Steamworks ticket: Invalid API key', errorOpts)
  } else if (!res.data?.response?.params) {
    throw new Error(
      'Failed to authenticate Steamworks ticket: Invalid response from Steamworks',
      errorOpts,
    )
  }

  return { status: res.status, data: res.data }
}

export type AuthenticateTicketResult = {
  steamId: string
  initialPlayerProps?: { key: string; value: string }[]
}

export async function authenticateTicket(
  em: EntityManager,
  integration: Integration,
  identifier: string,
): Promise<AuthenticateTicketResult> {
  const parts = identifier.split(':')
  const identity = parts.length > 1 ? parts[0] : undefined
  const ticket = parts.at(-1)
  // this assert shouldn't fail since identify() checks for empty identifiers
  assert(ticket, 'Missing Steamworks ticket')

  const { data: authenticateData } = await requestAuthenticateUserTicket({
    em,
    integration,
    ticket,
    identity,
  })

  const authenticateParams = authenticateData.response.params!
  const steamId = authenticateParams.steamid

  // set the cause to 400 so the api doesn't return a 500
  const errorOpts = { cause: 400 }
  const alias = await em.repo(PlayerAlias).findOne({
    service: PlayerAliasService.STEAM,
    identifier: steamId,
    player: {
      game: integration.game,
    },
  })

  const [{ status: verifyOwnershipStatus, data: verifyOwnershipData }, playerSummary] =
    await Promise.all([
      verifyOwnership({ em, integration, steamId }),
      getPlayerSummary({ em, integration, steamId }),
    ])

  if (verifyOwnershipStatus === 403) {
    throw new Error('Failed to verify Steamworks ownership: Invalid API key', errorOpts)
  }

  const { ownsapp, permanent, timestamp } = verifyOwnershipData.appownership
  const { vacbanned, publisherbanned } = authenticateParams

  const props = [
    { key: 'META_STEAMWORKS_VAC_BANNED', value: String(vacbanned) },
    { key: 'META_STEAMWORKS_PUBLISHER_BANNED', value: String(publisherbanned) },
    { key: 'META_STEAMWORKS_OWNS_APP', value: String(ownsapp) },
    { key: 'META_STEAMWORKS_OWNS_APP_PERMANENTLY', value: String(permanent) },
    { key: 'META_STEAMWORKS_OWNS_APP_FROM_DATE', value: timestamp },
  ]

  if (playerSummary) {
    props.push({ key: 'META_STEAMWORKS_PERSONA_NAME', value: playerSummary.personaname })
    props.push({ key: 'META_STEAMWORKS_AVATAR_HASH', value: playerSummary.avatarhash })
  } else {
    captureException(new Error('Failed to find Steamworks player summary'), {
      extra: {
        steamId,
        integrationId: integration.id,
      },
    })
  }

  if (alias) {
    for (const prop of props) {
      alias.player.upsertProp(prop.key, prop.value)
    }
    await em.flush()
    return { steamId }
  } else {
    return { steamId, initialPlayerProps: props }
  }
}

export async function verifyOwnership({
  em,
  integration,
  steamId,
}: {
  em: EntityManager
  integration: Integration
  steamId: string
}) {
  const client = new SteamworksClient(integration)
  const { res, event } = await client.makeRequest<CheckAppOwnershipResponse>({
    method: 'GET',
    url: `/ISteamUser/CheckAppOwnership/v3?appid=${integration.getConfig().appId}&steamid=${steamId}`,
  })
  await em.persist(event).flush()

  if (res.status >= 500) {
    throw new Error('Failed to verify Steamworks ownership: Steam service unavailable', {
      cause: 400,
    })
  }

  if (res.status === 200 && !res.data?.appownership) {
    throw new Error('Failed to verify Steamworks ownership: Invalid response from Steamworks', {
      cause: 400,
    })
  }

  return { status: res.status, data: res.data }
}

export async function getPlayerSummary({
  em,
  integration,
  steamId,
}: {
  em: EntityManager
  integration: Integration
  steamId: string
}): Promise<GetPlayerSummariesResponse['response']['players'][number] | null> {
  const client = new SteamworksClient(integration)
  const { res, event } = await client.makeRequest<GetPlayerSummariesResponse>({
    method: 'GET',
    url: `/ISteamUser/GetPlayerSummaries/v2?steamids=${steamId}`,
  })
  await em.persist(event).flush()

  if (res.status !== 200) {
    return null
  }

  if (!Array.isArray(res.data?.response?.players)) {
    return null
  }

  return res.data.response.players.find((p) => p.steamid === steamId) ?? null
}

export async function cleanupSteamworksLeaderboardEntry(
  em: EntityManager,
  integration: Integration,
  steamworksEntry: SteamworksLeaderboardEntry,
) {
  const event = await requestDeleteLeaderboardScore({
    integration,
    steamworksLeaderboardId: steamworksEntry.steamworksLeaderboard.steamworksLeaderboardId,
    steamUserId: steamworksEntry.steamUserId,
  })

  em.persist(event)
  em.remove(steamworksEntry)
  await em.flush()
}

export async function cleanupSteamworksPlayerStat(
  em: EntityManager,
  integration: Integration,
  steamworksPlayerStat: SteamworksPlayerStat,
) {
  // can't delete stats
  const event = await requestSetSteamworksUserStat({
    integration,
    stat: steamworksPlayerStat.stat,
    steamUserId: steamworksPlayerStat.steamUserId,
    value: steamworksPlayerStat.stat.defaultValue,
  })

  em.persist(event)
  em.remove(steamworksPlayerStat)
  await em.flush()
}
