import { EntityManager, MikroORM } from '@mikro-orm/mysql'
import ormConfig from '../config/mikro-orm.config'
import createClickHouseClient from '../lib/clickhouse/createClient'
import PlayerSession, { ClickHousePlayerSession } from '../entities/player-session'
import { ClickHouseClient } from '@clickhouse/client'
import PlayerAlias from '../entities/player-alias'
import { ClickHouseSocketEvent } from '../socket/socketEvent'
import { v4 } from 'uuid'
import { addMinutes, differenceInMinutes } from 'date-fns'

type CleanupStats = {
  unfinishedSessions: number
  hadClosedEvent: number
  hadNoEvents: number
  hadSessionSinceOriginal: number
  newSessionDurationMinutes: number[]
}

let cleanupStats: Record<number, CleanupStats>

function getOrCreateGameCleanupStats(gameId: number): CleanupStats {
  if (!cleanupStats[gameId]) {
    cleanupStats[gameId] = {
      unfinishedSessions: 0,
      hadClosedEvent: 0,
      hadNoEvents: 0,
      hadSessionSinceOriginal: 0,
      newSessionDurationMinutes: []
    }
  }
  return cleanupStats[gameId]
}

async function cleanupSession(em: EntityManager, clickhouse: ClickHouseClient, session: ClickHousePlayerSession) {
  const gameStats = getOrCreateGameCleanupStats(session.game_id)
  gameStats.unfinishedSessions++

  const aliases = await em.createQueryBuilder(PlayerAlias)
    .select('id')
    .where({ player: session.player_id })
    .getResultList()

  const sessionSinceOriginal = await clickhouse.query({
    query: `
      SELECT started_at from player_sessions
      WHERE player_id = '${session.player_id}' AND started_at > '${session.started_at}'
      ORDER BY started_at ASC
      LIMIT 1
    `,
    format: 'JSONEachRow'
  })
    .then((res) => res.json<Pick<ClickHousePlayerSession, 'started_at'>>())
    .then((res) => res[0])

  if (sessionSinceOriginal) {
    gameStats.hadSessionSinceOriginal++
  }

  const socketEvents = await clickhouse.query({
    query: `
      SELECT event_type, created_at FROM socket_events
      WHERE
        player_alias_id IN {aliasIds:Array(UInt32)}
        AND created_at <= dateSub(DAY, 1, now())
        ${sessionSinceOriginal ? `AND created_at <= '${sessionSinceOriginal.started_at}'` : ''}
      ORDER BY created_at DESC
      LIMIT 5
    `,
    format: 'JSONEachRow',
    query_params: {
      aliasIds: aliases.map(({ id }) => id)
    }
  }).then((res) => res.json<Pick<ClickHouseSocketEvent, 'event_type' | 'created_at'>>())

  const hydratedSession = await new PlayerSession().hydrate(em, session)
  const prevSessionId = hydratedSession.id

  const closeEvent = socketEvents.find(({ event_type }) => event_type === 'close')
  if (closeEvent) {
    hydratedSession.endedAt = new Date(closeEvent.created_at)
    gameStats.hadClosedEvent++
  } else {
    if (socketEvents.length > 0) {
      hydratedSession.endedAt = new Date(socketEvents[0].created_at)
    } else {
      hydratedSession.endedAt = new Date(addMinutes(hydratedSession.startedAt, 1))
      gameStats.hadNoEvents++
    }
  }

  hydratedSession.id = v4()
  await clickhouse.exec({ query: `DELETE FROM player_sessions WHERE id = '${prevSessionId}'` })
  await clickhouse.insert({
    table: 'player_sessions',
    values: hydratedSession.toInsertable(),
    format: 'JSON'
  })

  const duration = differenceInMinutes(hydratedSession.endedAt, hydratedSession.startedAt)
  gameStats.newSessionDurationMinutes.push(duration)
}

export default async function cleanupOnlinePlayers() {
  const orm = await MikroORM.init(ormConfig)
  const em = orm.em.fork()
  const clickhouse = createClickHouseClient()

  cleanupStats = {}

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
    await cleanupSession(em, clickhouse, session)
  }

  await orm.close()
  await clickhouse.close()

  console.table(cleanupStats)
}
