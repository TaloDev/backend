import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import querystring from 'qs'
import Integration from '../../../entities/integration'
import Leaderboard, { LeaderboardSortMode } from '../../../entities/leaderboard'
import LeaderboardEntry from '../../../entities/leaderboard-entry'
import Player from '../../../entities/player'
import PlayerAlias, { PlayerAliasService } from '../../../entities/player-alias'
import { SteamworksLeaderboardEntry } from '../../../entities/steamworks-leaderboard-entry'
import SteamworksLeaderboardMapping from '../../../entities/steamworks-leaderboard-mapping'
import { getResultCacheOptions } from '../../perf/getResultCacheOptions'
import { streamByCursor } from '../../perf/streamByCursor'
import {
  FindOrCreateLeaderboardResponse,
  GetLeaderboardEntriesResponse,
  GetLeaderboardEntriesResponseEntry,
  GetLeaderboardsForGameResponse,
  GetLeaderboardsForGameResponseLeaderboard,
  SteamworksClient,
  SteamworksNetworkError,
} from '../clients/steamworks-client'

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

  const steamworksLeaderboard = res?.data?.result?.leaderboard
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
    const { event, success } = await client.makeRequest({
      method: 'POST',
      url: '/ISteamLeaderboards/SetLeaderboardScore/v1',
      body,
    })
    await em.persist(event).flush()

    if (!success) {
      throw new SteamworksNetworkError()
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
  return { event }
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
    const { event } = await requestDeleteLeaderboardScore({
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

  return res?.data
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

  for (const steamEntryData of entriesRes?.leaderboardEntryInformation.leaderboardEntries ?? []) {
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

  const steamworksLeaderboards = res?.data?.response?.leaderboards
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

export async function cleanupSteamworksLeaderboardEntry(
  em: EntityManager,
  integration: Integration,
  steamworksEntry: SteamworksLeaderboardEntry,
) {
  const { event } = await requestDeleteLeaderboardScore({
    integration,
    steamworksLeaderboardId: steamworksEntry.steamworksLeaderboard.steamworksLeaderboardId,
    steamUserId: steamworksEntry.steamUserId,
  })

  em.persist(event)
  em.remove(steamworksEntry)
  await em.flush()
}
