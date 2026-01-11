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

type CleanupStats = {
  sessionsDeleted: number
  presenceUpdated: number
  presenceDeleted: number
  presenceStillOnline: number
}

let cleanupStats: CleanupStats

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

  // map playerId to latest session
  const sessionsByPlayer = new Map<string, ClickHousePlayerSession>()
  for (const session of sessions) {
    if (!sessionsByPlayer.has(session.player_id)) {
      sessionsByPlayer.set(session.player_id, session)
    }
  }

  return sessionsByPlayer
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
  const disconnectedPresenceCount = await em.nativeDelete(PlayerPresence, {
    player: null
  })
  cleanupStats.presenceDeleted += disconnectedPresenceCount

  const onlinePresence = await em.repo(PlayerPresence).find({
    online: true,
    updatedAt: {
      $lte: subMinutes(new Date(), 30)
    }
  }, {
    limit: BATCH_SIZE,
    populate: ['player']
  })

  if (onlinePresence.length > 0) {
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
    const unfinishedSessionIds: string[] = []

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
        unfinishedSessionIds.push(latestSession.id)
      }
    }

    if (unfinishedSessionIds.length > 0) {
      cleanupStats.sessionsDeleted += unfinishedSessionIds.length
      await clickhouse.exec({
        query: 'DELETE FROM player_sessions WHERE id IN ({sessionIds:Array(String)})',
        query_params: { sessionIds: unfinishedSessionIds }
      })
    }
  }

  await em.flush()
  await clickhouse.close()

  console.info(`Cleanup online players stats: ${JSON.stringify(cleanupStats, null, 2)}`)
}
