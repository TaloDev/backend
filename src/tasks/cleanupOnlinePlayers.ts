import { EntityManager } from '@mikro-orm/mysql'
import { getMikroORM } from '../config/mikro-orm.config'
import createClickHouseClient from '../lib/clickhouse/createClient'
import { ClickHousePlayerSession } from '../entities/player-session'
import { ClickHouseClient } from '@clickhouse/client'
import { subDays } from 'date-fns'
import PlayerPresence from '../entities/player-presence'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'

type CleanupStats = {
  sessionsDeleted: number
  presenceUpdated: number
  presenceDeleted: number
}

let cleanupStats: CleanupStats

async function deleteSession(clickhouse: ClickHouseClient, sessionId: string) {
  await clickhouse.exec({
    query: 'DELETE FROM player_sessions WHERE id = {sessionId:String}',
    query_params: { sessionId }
  })
  cleanupStats.sessionsDeleted++
}

async function cleanupPresence(em: EntityManager, clickhouse: ClickHouseClient, presence: PlayerPresence) {
  const latestSessionForPresence = await clickhouse.query({
    query: `
      SELECT ended_at from player_sessions
      WHERE player_id = {playerId:String} AND ended_at >= {endedAt:String}
      LIMIT 1
    `,
    query_params: {
      playerId: presence.player.id,
      endedAt: formatDateForClickHouse(presence.updatedAt)
    },
    format: 'JSONEachRow'
  })
    .then((res) => res.json<Pick<ClickHousePlayerSession, 'ended_at'>>())
    .then((res) => res[0])

  if (latestSessionForPresence?.ended_at) {
    cleanupStats.presenceUpdated++
    presence.online = false
    await em.flush()
  }
}

async function removeDisconnectedPresence(em: EntityManager, presence: PlayerPresence) {
  cleanupStats.presenceDeleted++
  await em.removeAndFlush(presence)
}

export default async function cleanupOnlinePlayers() {
  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager
  const clickhouse = createClickHouseClient()

  cleanupStats = {
    sessionsDeleted: 0,
    presenceUpdated: 0,
    presenceDeleted: 0
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

  console.info(`Found ${sessions.length} unfinished sessions`)

  for (const session of sessions) {
    await deleteSession(clickhouse, session.id)
  }

  // todo, find out how this is happening
  const disconnectedPresence = await em.repo(PlayerPresence).find({
    player: null
  })

  console.info(`Found ${disconnectedPresence.length} disconnected presence`)

  for (const presence of disconnectedPresence) {
    await removeDisconnectedPresence(em, presence)
  }

  const onlinePresence = await em.repo(PlayerPresence).find({
    online: true,
    updatedAt: {
      $lte: subDays(new Date(), 1)
    }
  }, {
    limit: 100,
    populate: ['player']
  })

  console.info(`Found ${onlinePresence.length} online presence`)

  for (const presence of onlinePresence) {
    await cleanupPresence(em, clickhouse, presence)
  }

  await clickhouse.close()

  console.info(`Cleanup stats: ${JSON.stringify(cleanupStats, null, 2)}`)
}
