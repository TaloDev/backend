import { EntityManager } from '@mikro-orm/mysql'
import { getMikroORM } from '../config/mikro-orm.config'
import createClickHouseClient from '../lib/clickhouse/createClient'
import { ClickHousePlayerSession } from '../entities/player-session'
import { ClickHouseClient } from '@clickhouse/client'
import { subMinutes } from 'date-fns'
import PlayerPresence from '../entities/player-presence'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import { getSocketInstance } from '../socket/socketRegistry'

const BATCH_SIZE = 500

let cleanupStats: {
  sessionsDeleted: number
  presenceUpdated: number
  presenceDeleted: number
  presenceStillOnline: number
}

async function deleteDisconnectedPresence(em: EntityManager) {
  const disconnectedPresenceCount = await em.nativeDelete(PlayerPresence, {
    player: null
  })
  cleanupStats.presenceDeleted += disconnectedPresenceCount
}

async function getSessions(clickhouse: ClickHouseClient, onlinePresence: PlayerPresence[]) {
  const playerIds = onlinePresence.map((p) => p.player.id)
  const oldestUpdatedAt = onlinePresence.reduce((oldest, p) =>
    p.updatedAt < oldest ? p.updatedAt : oldest,
  onlinePresence[0].updatedAt)

  const sessions = await clickhouse.query({
    query: `
      SELECT id, player_id, ended_at, started_at
      FROM player_sessions
      WHERE player_id IN ({playerIds:Array(String)})
        AND (ended_at >= {cutoffTime:DateTime64(3)} OR ended_at IS NULL)
      ORDER BY player_id, ended_at DESC NULLS FIRST
    `,
    query_params: {
      playerIds,
      cutoffTime: formatDateForClickHouse(oldestUpdatedAt)
    },
    format: 'JSONEachRow'
  }).then((res) => res.json<ClickHousePlayerSession>())

  // map players to their latest session
  const sessionsByPlayer = new Map<string, ClickHousePlayerSession>()
  for (const session of sessions) {
    if (!sessionsByPlayer.has(session.player_id)) {
      sessionsByPlayer.set(session.player_id, session)
    }
  }

  return sessionsByPlayer
}

async function cleanupStaleOnlinePresence(em: EntityManager, clickhouse: ClickHouseClient) {
  const onlinePresence = await em.repo(PlayerPresence).find({
    online: true,
    updatedAt: {
      $lte: subMinutes(new Date(), 30)
    }
  }, {
    limit: BATCH_SIZE,
    populate: ['player']
  })

  if (onlinePresence.length === 0) {
    return
  }

  const socket = getSocketInstance()
  const activePlayerAliasIds = new Set<number>()
  if (socket) {
    const activeConnections = socket.findConnections(() => true)
    for (const conn of activeConnections) {
      if (conn.playerAliasId) {
        activePlayerAliasIds.add(conn.playerAliasId)
      }
    }
  }

  const sessionsByPlayer = await getSessions(clickhouse, onlinePresence)

  for (const presence of onlinePresence) {
    if (activePlayerAliasIds.has(presence.playerAlias.id)) {
      cleanupStats.presenceStillOnline++
      continue
    }

    const latestSession = sessionsByPlayer.get(presence.player.id)

    // mark offline if presence is stale (>30 min) and no active WebSocket, AND:
    // 1. no session found at all, OR
    // 2. session ended after the presence was last updated (proof of disconnect), OR
    // 3. session exists but never ended (ended_at is null), meaning improper disconnect
    if (!latestSession) {
      cleanupStats.presenceUpdated++
      presence.online = false
    } else if (latestSession.ended_at && new Date(latestSession.ended_at) >= presence.updatedAt) {
      cleanupStats.presenceUpdated++
      presence.online = false
    } else if (!latestSession.ended_at) {
      cleanupStats.presenceUpdated++
      presence.online = false
    }
  }
}

async function cleanupUnfinishedSessions(em: EntityManager, clickhouse: ClickHouseClient) {
  const unfinishedSessions = await clickhouse.query({
    query: `
      SELECT id, player_id
      FROM player_sessions
      WHERE ended_at IS NULL
      LIMIT {limit:UInt32}
    `,
    query_params: { limit: BATCH_SIZE },
    format: 'JSONEachRow'
  }).then((res) => res.json<{ id: string, player_id: string }>())

  if (unfinishedSessions.length === 0) {
    return
  }

  // map players to their presence
  const playerIds = unfinishedSessions.map((s) => s.player_id)
  const presenceMap = await em.repo(PlayerPresence).find({
    player: { id: { $in: playerIds } }
  }, {
    populate: ['player']
  }).then((presence) => {
    const map = new Map<string, PlayerPresence>()
    for (const p of presence) {
      map.set(p.player.id, p)
    }
    return map
  })

  // delete sessions where the player is offline (or has no presence)
  const sessionsToDelete: string[] = []
  for (const session of unfinishedSessions) {
    const presence = presenceMap.get(session.player_id)
    if (!presence || !presence.online) {
      sessionsToDelete.push(session.id)
    }
  }

  if (sessionsToDelete.length > 0) {
    cleanupStats.sessionsDeleted += sessionsToDelete.length
    await clickhouse.exec({
      query: 'DELETE FROM player_sessions WHERE id IN ({sessionIds:Array(String)})',
      query_params: { sessionIds: sessionsToDelete }
    })
  }
}

export default async function cleanupOnlinePlayers() {
  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager
  const clickhouse = createClickHouseClient()

  cleanupStats = {
    sessionsDeleted: 0,
    presenceUpdated: 0,
    presenceDeleted: 0,
    presenceStillOnline: 0
  }

  // todo: find out how this is happening
  await deleteDisconnectedPresence(em)

  await cleanupStaleOnlinePresence(em, clickhouse)
  await em.flush()

  await cleanupUnfinishedSessions(em, clickhouse)
  await clickhouse.close()

  console.info(`Cleanup online players stats: ${JSON.stringify(cleanupStats, null, 2)}`)
}
