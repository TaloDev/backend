import { EntityManager } from '@mikro-orm/mysql'
import { getMikroORM } from '../config/mikro-orm.config'
import createClickHouseClient from '../lib/clickhouse/createClient'
import { ClickHousePlayerSession } from '../entities/player-session'
import { ClickHouseClient } from '@clickhouse/client'
import { subHours } from 'date-fns'
import PlayerPresence from '../entities/player-presence'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import { getSocketInstance } from '../socket/socketRegistry'

type CleanupStats = {
  sessionsDeleted: number
  presenceUpdated: number
  presenceDeleted: number
  presenceCheckedAgainstSocket: number
}

let cleanupStats: CleanupStats

async function deleteSessions(clickhouse: ClickHouseClient, sessionIds: string[]) {
  await clickhouse.exec({
    query: 'DELETE FROM player_sessions WHERE id IN ({sessionIds:Array(String)})',
    query_params: { sessionIds }
  })
  cleanupStats.sessionsDeleted += sessionIds.length
}

async function getSessions(clickhouse: ClickHouseClient, onlinePresence: PlayerPresence[]) {
  const playerIds = onlinePresence.map((p) => p.player.id)
  const oldestUpdatedAt = onlinePresence.reduce((oldest, p) =>
    p.updatedAt < oldest ? p.updatedAt : oldest,
  onlinePresence[0].updatedAt)

  const sessions = await clickhouse.query({
    query: `
      SELECT player_id, ended_at, started_at
      FROM player_sessions
      WHERE player_id IN ({playerIds:Array(String)})
        AND ended_at >= {cutoffTime:DateTime64(3)}
      ORDER BY player_id, ended_at DESC
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
    presenceCheckedAgainstSocket: 0
  }

  const sessions = await clickhouse.query({
    query: `
      SELECT * FROM player_sessions
      WHERE ended_at IS NULL AND started_at <= dateSub(DAY, 1, now())
      ORDER BY started_at DESC
      LIMIT 100
    `,
    format: 'JSONEachRow'
  }).then((res) => res.json<ClickHousePlayerSession>())

  if (sessions.length > 0) {
    const sessionIds = sessions.map((s) => s.id)
    await deleteSessions(clickhouse, sessionIds)
  }

  // todo: find out how this is happening
  const disconnectedPresenceCount = await em.nativeDelete(PlayerPresence, {
    player: null
  })
  cleanupStats.presenceDeleted += disconnectedPresenceCount

  const onlinePresence = await em.repo(PlayerPresence).find({
    online: true,
    updatedAt: {
      $lte: subHours(new Date(), 1)
    }
  }, {
    limit: 100,
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

    for (const presence of onlinePresence) {
      if (activePlayerAliasIds.has(presence.playerAlias.id)) {
        cleanupStats.presenceCheckedAgainstSocket++
        continue
      }

      // check if there's a session that ended after the presence was updated
      const latestSession = sessionsByPlayer.get(presence.player.id)
      if (latestSession?.ended_at && new Date(latestSession.ended_at) >= presence.updatedAt) {
        cleanupStats.presenceUpdated++
        presence.online = false
      }
    }
  }

  await em.flush()
  await clickhouse.close()

  console.info(`Cleanup online players stats: ${JSON.stringify(cleanupStats, null, 2)}`)
}
