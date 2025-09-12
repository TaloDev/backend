import { EntityManager } from '@mikro-orm/mysql'
import Leaderboard, { LeaderboardSortMode } from '../../entities/leaderboard'
import axios, { AxiosError, AxiosResponse } from 'axios'
import querystring from 'qs'
import Integration from '../../entities/integration'
import SteamworksIntegrationEvent, { SteamworksRequestMethod, SteamworksResponseStatusCode } from '../../entities/steamworks-integration-event'
import LeaderboardEntry from '../../entities/leaderboard-entry'
import SteamworksLeaderboardMapping from '../../entities/steamworks-leaderboard-mapping'
import PlayerAlias, { PlayerAliasService } from '../../entities/player-alias'
import Player from '../../entities/player'
import { performance } from 'perf_hooks'
import GameStat from '../../entities/game-stat'
import PlayerGameStat from '../../entities/player-game-stat'
import { Request } from 'koa-clay'
import { SteamworksLeaderboardEntry } from '../../entities/steamworks-leaderboard-entry'
import assert from 'node:assert'

type SteamworksRequestConfig = {
  method: SteamworksRequestMethod
  baseURL: string
  url: string
  headers: {
    'x-webapi-key': string
  }
  data: string
}

type FindOrCreateLeaderboardResponseLeaderboard = {
  leaderBoardID: number
  leaderboardName: string
  onlyfriendsreads: boolean
  onlytrustedwrites: boolean
  leaderBoardEntries: number
  leaderBoardSortMethod: 'Ascending' | 'Descending'
  leaderBoardDisplayType: 'Numeric'
}

type FindOrCreateLeaderboardResponse = {
  result: {
    result: number
    leaderboard?: FindOrCreateLeaderboardResponseLeaderboard
  }
}

type GetLeaderboardsForGameResponseLeaderboard = {
  id: number
  name: string
  entries: number
  sortmethod: 'Ascending' | 'Descending'
  displaytype: 'Numeric'
  onlyfriendsreads: boolean
  onlytrustedwrites: boolean
}

export type GetLeaderboardsForGameResponse = {
  response: {
    result: number
    leaderboards?: GetLeaderboardsForGameResponseLeaderboard[]
  }
}

export type GetLeaderboardEntriesResponse = {
  leaderboardEntryInformation: {
    appID: number
    leaderboardID: number
    totalLeaderBoardEntryCount: number
    leaderboardEntries: {
      steamID: string
      score: number
      rank: number
      ugcid: string
    }[]
  }
}

type CombinedLeaderboards = [Leaderboard, GetLeaderboardsForGameResponseLeaderboard | null, SteamworksLeaderboardMapping | null]

export type GetSchemaForGameResponse = {
  game: {
    gameName: string
    gameVersion: string
    availableGameStats: {
      stats: [
        {
          name: string
          defaultvalue: number
          displayName: string
        }
      ]
      achievements: unknown[]
    }
  }
}

export type GetUserStatsForGameResponse = {
  playerstats: {
    steamID: string
    gameName: string
    stats: {
      name: string
      value: number
    }[]
    achievements: unknown[]
  }
}

export type AuthenticateUserTicketResponse = {
  response: {
    params?: {
      result: 'OK'
      steamid: string
      ownersteamid: string
      vacbanned: boolean
      publisherbanned: boolean
    }
    error?: {
      errorcode: number
      errordesc: string
    }
  }
}

export type CheckAppOwnershipResponse = {
  appownership: {
    ownsapp: boolean
    permanent: boolean
    timestamp: string
    ownersteamid: string
    sitelicense: boolean
    timedtrial: boolean
    usercanceled: boolean
    result: 'OK'
  }
}

function createSteamworksRequestConfig(integration: Integration, method: SteamworksRequestMethod, url: string, body = ''): SteamworksRequestConfig {
  return {
    method,
    baseURL: 'https://partner.steam-api.com',
    url,
    headers: { 'x-webapi-key': integration.getSteamAPIKey() },
    data: body
  }
}

function createSteamworksIntegrationEvent(integration: Integration, config: SteamworksRequestConfig): SteamworksIntegrationEvent {
  const event = new SteamworksIntegrationEvent(integration)
  event.request = {
    method: config.method,
    url: config.baseURL + config.url,
    body: config.data
  }

  return event
}

async function makeRequest<T>(config: SteamworksRequestConfig, event: SteamworksIntegrationEvent): Promise<AxiosResponse<T, SteamworksRequestConfig>> {
  const startTime = performance.now()

  try {
    const res = await axios(config)
    const endTime = performance.now()

    event.response = {
      status: res.status as SteamworksResponseStatusCode,
      body: res.data,
      timeTaken: endTime - startTime
    }

    return res
  } catch (err) {
    const endTime = performance.now()

    event.response = {
      status: (err as AxiosError).response!.status as SteamworksResponseStatusCode,
      body: (err as AxiosError).response!.data as { [key: string]: unknown },
      timeTaken: endTime - startTime
    }

    return (err as AxiosError).response as AxiosResponse
  }
}

export async function createSteamworksLeaderboard(em: EntityManager, integration: Integration, leaderboard: Leaderboard) {
  const body = querystring.stringify({
    appid: integration.getConfig().appId,
    name: leaderboard.internalName,
    sortmethod: leaderboard.sortMode === LeaderboardSortMode.ASC ? 'Ascending' : 'Descending',
    displaytype: 'Numeric',
    createifnotfound: true,
    onlytrustedwrites: true,
    onlyfriendsreads: false
  })

  const config = createSteamworksRequestConfig(integration, 'POST', '/ISteamLeaderboards/FindOrCreateLeaderboard/v2', body)
  const event = createSteamworksIntegrationEvent(integration, config)

  const res = await makeRequest<FindOrCreateLeaderboardResponse>(config, event)
  await em.persistAndFlush(event)

  const steamworksLeaderboard = res.data.result?.leaderboard
  if (steamworksLeaderboard) {
    await em.repo(SteamworksLeaderboardMapping).upsert({
      steamworksLeaderboardId: steamworksLeaderboard.leaderBoardID,
      leaderboard,
      createdAt: new Date()
    })
  }
}

export async function deleteSteamworksLeaderboard(em: EntityManager, integration: Integration, leaderboardInternalName: string) {
  const body = querystring.stringify({
    appid: integration.getConfig().appId,
    name: leaderboardInternalName
  })

  const config = createSteamworksRequestConfig(integration, 'POST', '/ISteamLeaderboards/DeleteLeaderboard/v1', body)
  const event = createSteamworksIntegrationEvent(integration, config)
  await makeRequest(config, event)

  await em.persistAndFlush(event)
}

export async function createSteamworksLeaderboardEntry(em: EntityManager, integration: Integration, entry: LeaderboardEntry) {
  const leaderboardMapping = await em.getRepository(SteamworksLeaderboardMapping).findOne({ leaderboard: entry.leaderboard })

  if (leaderboardMapping) {
    const body = querystring.stringify({
      appid: integration.getConfig().appId,
      leaderboardid: leaderboardMapping.steamworksLeaderboardId,
      steamid: entry.playerAlias.identifier,
      score: entry.score,
      scoremethod: 'KeepBest'
    })

    const config = createSteamworksRequestConfig(integration, 'POST', '/ISteamLeaderboards/SetLeaderboardScore/v1', body)
    const event = createSteamworksIntegrationEvent(integration, config)
    await makeRequest(config, event)

    await em.persistAndFlush(event)
    await em.upsert(new SteamworksLeaderboardEntry({
      steamworksLeaderboard: leaderboardMapping,
      leaderboardEntry: entry,
      steamUserId: entry.playerAlias.identifier
    }))
  }
}

export async function deleteSteamworksLeaderboardEntry(em: EntityManager, integration: Integration, entry: LeaderboardEntry) {
  const leaderboardMapping = await em.getRepository(SteamworksLeaderboardMapping).findOne({ leaderboard: entry.leaderboard })

  if (leaderboardMapping) {
    const body = querystring.stringify({
      appid: integration.getConfig().appId,
      leaderboardid: leaderboardMapping.steamworksLeaderboardId,
      steamid: entry.playerAlias.identifier
    })

    const config = createSteamworksRequestConfig(integration, 'POST', '/ISteamLeaderboards/DeleteLeaderboardScore/v1', body)
    const event = createSteamworksIntegrationEvent(integration, config)
    await makeRequest(config, event)

    await em.persistAndFlush(event)
    await em.repo(SteamworksLeaderboardEntry).nativeDelete({
      steamworksLeaderboard: leaderboardMapping,
      leaderboardEntry: entry
    })
  }
}

function mapSteamworksLeaderboardSortMode(sortMode: string) {
  return sortMode === 'Ascending'
    ? LeaderboardSortMode.ASC
    : LeaderboardSortMode.DESC
}

async function getEntriesForSteamworksLeaderboard(em: EntityManager, integration: Integration, leaderboardId: number): Promise<GetLeaderboardEntriesResponse> {
  const qs = querystring.stringify({
    appid: integration.getConfig().appId,
    leaderboardid: leaderboardId,
    rangestart: 0,
    rangeend: Number.MAX_VALUE,
    datarequest: 'RequestGlobal'
  })

  const config = createSteamworksRequestConfig(integration, 'GET', `/ISteamLeaderboards/GetLeaderboardEntries/v1?${qs}`)
  const event = createSteamworksIntegrationEvent(integration, config)
  const res = await makeRequest<GetLeaderboardEntriesResponse>(config, event)
  await em.persistAndFlush(event)

  return res.data
}

async function createLeaderboardEntry({
  em,
  leaderboardMapping,
  playerAlias,
  score
}: {
  em: EntityManager
  leaderboardMapping: SteamworksLeaderboardMapping
  playerAlias: PlayerAlias
  score: number
}): Promise<LeaderboardEntry> {
  const entry = new LeaderboardEntry(leaderboardMapping.leaderboard)
  entry.playerAlias = playerAlias
  entry.score = score

  const steamworksEntry = new SteamworksLeaderboardEntry({
    steamworksLeaderboard: leaderboardMapping,
    leaderboardEntry: entry,
    steamUserId: playerAlias.identifier
  })
  await em.persistAndFlush(steamworksEntry)

  return entry
}

export async function syncSteamworksLeaderboards(em: EntityManager, integration: Integration) {
  const config = createSteamworksRequestConfig(integration, 'GET', `/ISteamLeaderboards/GetLeaderboardsForGame/v2?appid=${integration.getConfig().appId}`)
  const event = createSteamworksIntegrationEvent(integration, config)
  const res = await makeRequest<GetLeaderboardsForGameResponse>(config, event)
  await em.persistAndFlush(event)

  await em.transactional(async (trx) => {
    const steamworksLeaderboards = res.data?.response?.leaderboards
    if (!Array.isArray(steamworksLeaderboards)) {
      throw new Error('Failed to retrieve leaderboards - is your App ID correct?')
    }

    const leaderboards = await trx.getRepository(Leaderboard).find({ game: integration.game })

    const combinedLeaderboards = await Promise.all(leaderboards.map(async (leaderboard): Promise<CombinedLeaderboards> => {
      const leaderboardMapping = await trx.getRepository(SteamworksLeaderboardMapping).findOne({ leaderboard })

      const mappingMatch = steamworksLeaderboards.find((steamworksLeaderboard) => steamworksLeaderboard.id === leaderboardMapping?.steamworksLeaderboardId)
      const nameMatch = steamworksLeaderboards.find((steamworksLeaderboard) => steamworksLeaderboard.name === leaderboard.internalName)

      return [leaderboard, mappingMatch ?? nameMatch ?? null, leaderboardMapping]
    }))

    for (const [leaderboard, steamworksLeaderboard, leaderboardMapping] of combinedLeaderboards) {
      // update talo leaderboards with properties from steamworks - because we can't do the other way around
      if (leaderboard && steamworksLeaderboard) {
        if (!leaderboardMapping) trx.persist(new SteamworksLeaderboardMapping(steamworksLeaderboard.id, leaderboard))

        leaderboard.internalName = leaderboard.name = steamworksLeaderboard.name
        leaderboard.sortMode = mapSteamworksLeaderboardSortMode(steamworksLeaderboard.sortmethod)
        leaderboard.unique = true
        // create in steamworks if it only exists in Talo
      } else if (leaderboard && !steamworksLeaderboard) {
        await createSteamworksLeaderboard(trx, integration, leaderboard)
      }
    }

    // create leaderboards in talo for ones that only exist in steamworks
    const leaderboardsOnlyInSteamworks = steamworksLeaderboards.filter((steamworksLeaderboard) => {
      return !leaderboards.find((leaderboard) => steamworksLeaderboard.name === leaderboard.internalName)
    })
    for (const steamworksLeaderboard of leaderboardsOnlyInSteamworks) {
      const leaderboard = new Leaderboard(integration.game)
      leaderboard.internalName = leaderboard.name = steamworksLeaderboard.name
      leaderboard.sortMode = mapSteamworksLeaderboardSortMode(steamworksLeaderboard.sortmethod)
      leaderboard.unique = true

      trx.persist(new SteamworksLeaderboardMapping(steamworksLeaderboard.id, leaderboard))
      trx.persist(leaderboard)
      leaderboards.push(leaderboard)
    }

    await trx.flush()

    const syncedEntryIds: number[] = []

    // push entries from steam into talo
    for (const steamworksLeaderboard of steamworksLeaderboards) {
      const leaderboard = leaderboards.find((leaderboard) => leaderboard.internalName === steamworksLeaderboard.name)
      assert(leaderboard, 'Leaderboard not found')

      const entriesRes = await getEntriesForSteamworksLeaderboard(trx, integration, steamworksLeaderboard.id)
      const leaderboardMapping = await trx.repo(SteamworksLeaderboardMapping).findOneOrFail({ leaderboard })

      for (const steamEntry of entriesRes.leaderboardEntryInformation.leaderboardEntries) {
        const existingPlayerAlias = await trx.repo(PlayerAlias).findOne({
          service: PlayerAliasService.STEAM,
          identifier: steamEntry.steamID,
          player: {
            game: integration.game
          }
        })

        if (existingPlayerAlias) {
          const existingEntry = await trx.repo(LeaderboardEntry).findOne({ leaderboard, playerAlias: existingPlayerAlias })
          if (!existingEntry) {
            const newEntry = await createLeaderboardEntry({
              em: trx,
              leaderboardMapping,
              playerAlias: existingPlayerAlias,
              score: steamEntry.score
            })
            syncedEntryIds.push(newEntry.id)
          }
          // if the alias doesnt exist then neither does the entry, so create both
        } else {
          const player = new Player(integration.game)
          player.addProp('importedFromSteam', new Date().toISOString())

          const playerAlias = new PlayerAlias()
          playerAlias.player = player
          playerAlias.service = PlayerAliasService.STEAM
          playerAlias.identifier = steamEntry.steamID
          player.aliases.add(playerAlias)

          const newEntry = await createLeaderboardEntry({
            em: trx,
            leaderboardMapping,
            playerAlias,
            score: steamEntry.score
          })
          syncedEntryIds.push(newEntry.id)
        }
      }
    }

    // push entries from talo into steam
    for (const leaderboard of leaderboards) {
      const entries = await leaderboard.entries.loadItems()
      for (const entry of entries) {
        if (!syncedEntryIds.includes(entry.id)) {
          await createSteamworksLeaderboardEntry(trx, integration, entry)
        }
      }
    }
  })
}

async function getSteamworksStatsForPlayer(em: EntityManager, integration: Integration, steamId: string): Promise<GetUserStatsForGameResponse> {
  const config = createSteamworksRequestConfig(integration, 'GET', `/ISteamUserStats/GetUserStatsForGame/v2?appid=${integration.getConfig().appId}&steamid=${steamId}`)
  const event = createSteamworksIntegrationEvent(integration, config)
  const res = await makeRequest<GetUserStatsForGameResponse>(config, event)
  await em.persistAndFlush(event)

  return res.data
}

export async function setSteamworksStat(em: EntityManager, integration: Integration, playerStat: PlayerGameStat, playerAlias: PlayerAlias) {
  const body = querystring.stringify({
    appid: integration.getConfig().appId,
    steamid: playerAlias.identifier,
    count: 1,
    name: [playerStat.stat.internalName],
    value: [playerStat.value]
  })

  const config = createSteamworksRequestConfig(integration, 'POST', '/ISteamUserStats/SetUserStatsForGame/v1', body)
  const event = createSteamworksIntegrationEvent(integration, config)
  await makeRequest(config, event)
  await em.persistAndFlush(event)
}

export async function syncSteamworksStats(em: EntityManager, integration: Integration) {
  const config = createSteamworksRequestConfig(integration, 'GET', `/ISteamUserStats/GetSchemaForGame/v2?appid=${integration.getConfig().appId}`)
  const event = createSteamworksIntegrationEvent(integration, config)
  const res = await makeRequest<GetSchemaForGameResponse>(config, event)
  await em.persistAndFlush(event)

  const steamworksStats = res.data?.game?.availableGameStats?.stats
  if (!Array.isArray(steamworksStats)) {
    throw new Error('Failed to retrieve stats - is your App ID correct?')
  }

  for (const steamworksStat of steamworksStats) {
    const existingStat = await em.getRepository(GameStat).findOne({ internalName: steamworksStat.name, game: integration.game })
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
  }

  await em.flush()

  const steamAliases = await em.getRepository(PlayerAlias).find({
    service: PlayerAliasService.STEAM,
    player: {
      game: integration.game
    }
  })

  const syncedPlayerStats: PlayerGameStat[] = []

  for (const steamAlias of steamAliases) {
    const res = await getSteamworksStatsForPlayer(em, integration, steamAlias.identifier)
    const steamworksPlayerStats = res?.playerstats?.stats ?? []

    for (const steamworksPlayerStat of steamworksPlayerStats) {
      const stat = await em.getRepository(GameStat).findOneOrFail({ internalName: steamworksPlayerStat.name })
      const existingPlayerStat = await em.getRepository(PlayerGameStat).findOne({
        player: steamAlias.player,
        stat
      }, { populate: ['player'] })

      if (existingPlayerStat) {
        existingPlayerStat.value = steamworksPlayerStat.value
        syncedPlayerStats.push(existingPlayerStat)
      } else {
        const playerStat = new PlayerGameStat(steamAlias.player, stat)
        playerStat.value = steamworksPlayerStat.value
        em.persist(playerStat)
        syncedPlayerStats.push(playerStat)
      }
    }
  }

  await em.flush()

  const unsyncedPlayerStats = await em.getRepository(PlayerGameStat).find({
    player: {
      id: steamAliases.map((alias) => alias.player.id)
    },
    stat: {
      internalName: steamworksStats.map((steamworksStat) => steamworksStat.name)
    }
  }, { populate: ['player', 'player.aliases'] })

  const filteredUnsyncedStats = unsyncedPlayerStats.filter((playerStat) => {
    const syncedIds = syncedPlayerStats.map((synced) => synced.id)
    return !syncedIds.includes(playerStat.id)
  })

  // push through player stats that aren't in steamworks
  for (const unsyncedPlayerStat of filteredUnsyncedStats) {
    const steamAlias = unsyncedPlayerStat.player.aliases.getItems().find((alias) => alias.service === PlayerAliasService.STEAM)
    await setSteamworksStat(em, integration, unsyncedPlayerStat, steamAlias!)
  }
}

export async function authenticateTicket(req: Request, integration: Integration, identifier: string): Promise<string> {
  const em: EntityManager = req.ctx.em

  const parts = identifier.split(':')
  const identity = parts.length > 1 ? parts[0] : undefined
  const ticket = parts.at(-1)

  const config = createSteamworksRequestConfig(integration, 'GET', `/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${integration.getConfig().appId}&ticket=${ticket}${identity ? `&identity=${identity}` : ''}`)
  const event = createSteamworksIntegrationEvent(integration, config)
  const res = await makeRequest<AuthenticateUserTicketResponse>(config, event)
  await em.persistAndFlush(event)

  if (res.data?.response?.error) {
    const message = `Failed to authenticate Steamworks ticket: ${res.data.response.error.errordesc} (${res.data.response.error.errorcode})`
    throw new Error(message, { cause: 400 })
  } else if (res.status === 403) {
    // set the cause to 400 so the api doesn't return a 500
    throw new Error('Failed to authenticate Steamworks ticket: Invalid API key', { cause: 400 })
  }

  const steamId = res.data.response.params!.steamid
  const alias = await em.getRepository(PlayerAlias).findOne({
    service: PlayerAliasService.STEAM,
    identifier: steamId,
    player: {
      game: integration.game
    }
  })

  const {
    appownership: {
      ownsapp,
      permanent,
      timestamp
    }
  } = await verifyOwnership(em, integration, steamId)

  const { vacbanned, publisherbanned } = res.data.response.params!

  if (alias) {
    alias.player.upsertProp('META_STEAMWORKS_VAC_BANNED', String(vacbanned))
    alias.player.upsertProp('META_STEAMWORKS_PUBLISHER_BANNED', String(publisherbanned))
    alias.player.upsertProp('META_STEAMWORKS_OWNS_APP', String(ownsapp))
    alias.player.upsertProp('META_STEAMWORKS_OWNS_APP_PERMANENTLY', String(permanent))
    alias.player.upsertProp('META_STEAMWORKS_OWNS_APP_FROM_DATE', timestamp)
    await em.flush()
  } else {
    req.ctx.state.initialPlayerProps = [
      { key: 'META_STEAMWORKS_VAC_BANNED', value: String(vacbanned) },
      { key: 'META_STEAMWORKS_PUBLISHER_BANNED', value: String(publisherbanned) },
      { key: 'META_STEAMWORKS_OWNS_APP', value: String(ownsapp) },
      { key: 'META_STEAMWORKS_OWNS_APP_PERMANENTLY', value: String(permanent) },
      { key: 'META_STEAMWORKS_OWNS_APP_FROM_DATE', value: timestamp }
    ]
  }

  return steamId
}

export async function verifyOwnership(em: EntityManager, integration: Integration, steamId: string): Promise<CheckAppOwnershipResponse> {
  const config = createSteamworksRequestConfig(integration, 'GET', `/ISteamUser/CheckAppOwnership/v3?appid=${integration.getConfig().appId}&steamid=${steamId}`)
  const event = createSteamworksIntegrationEvent(integration, config)
  const res = await makeRequest<CheckAppOwnershipResponse>(config, event)
  await em.persistAndFlush(event)

  return res.data
}

export async function cleanupSteamworksLeaderboardEntry(
  em: EntityManager,
  integration: Integration,
  steamworksEntry: SteamworksLeaderboardEntry
) {
  const body = querystring.stringify({
    appid: integration.getConfig().appId,
    leaderboardid: steamworksEntry.steamworksLeaderboard.steamworksLeaderboardId,
    steamid: steamworksEntry.steamUserId
  })

  const config = createSteamworksRequestConfig(integration, 'POST', '/ISteamLeaderboards/DeleteLeaderboardScore/v1', body)
  const event = createSteamworksIntegrationEvent(integration, config)
  await makeRequest(config, event)

  em.persist(event)
  em.remove(steamworksEntry)
  await em.flush()
}
