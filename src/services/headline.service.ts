import { EntityManager, raw } from '@mikro-orm/mysql'
import { endOfDay, startOfDay } from 'date-fns'
import { Service, Request, Response, Validate, HasPermission, Route } from 'koa-clay'
import Player from '../entities/player'
import HeadlinePolicy from '../policies/headline.policy'
import dateValidationSchema from '../lib/dates/dateValidationSchema'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import { ClickHouseClient } from '@clickhouse/client'
import { getResultCacheOptions } from '../lib/perf/getResultCacheOptions'
import { withResponseCache } from '../lib/perf/responseCache'
import Game from '../entities/game'
import assert from 'node:assert'

const HEADLINES_CACHE_TTL_MS = 300_000
const ONLINE_PLAYERS_CACHE_TTL_MS = 30_000

export default class HeadlineService extends Service {
  @Route({
    method: 'GET',
    path: '/new_players'
  })
  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async newPlayers(req: Request): Promise<Response> {
    const { startDate, endDate } = req.query
    const em: EntityManager = req.ctx.em

    assert(startDate)
    assert(endDate)

    const game: Game = req.ctx.state.game
    const includeDevData = req.ctx.state.includeDevData
    const count = await em.getRepository(Player).count({
      game,
      ...(includeDevData ? {} : { devBuild: false }),
      createdAt: {
        $gte: startOfDay(new Date(startDate)),
        $lte: endOfDay(new Date(endDate))
      }
    }, getResultCacheOptions(`new-players-${game.id}-${includeDevData}-${startDate}-${endDate}`, HEADLINES_CACHE_TTL_MS))

    return {
      status: 200,
      body: {
        count
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/returning_players'
  })
  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async returningPlayers(req: Request): Promise<Response> {
    const { startDate, endDate } = req.query
    const em: EntityManager = req.ctx.em

    assert(startDate)
    assert(endDate)

    const game: Game = req.ctx.state.game
    const includeDevData = req.ctx.state.includeDevData
    const count = await em.getRepository(Player).count({
      game,
      ...(req.ctx.state.includeDevData ? {} : { devBuild: false }),
      lastSeenAt: {
        $gte: startOfDay(new Date(startDate)),
        $lte: endOfDay(new Date(endDate))
      },
      createdAt: {
        $lt: startOfDay(new Date(startDate))
      },
      [raw('datediff(created_at, last_seen_at)')]: {
        $ne: 0
      }
    }, getResultCacheOptions(`returning-players-${game.id}-${includeDevData}-${startDate}-${endDate}`, HEADLINES_CACHE_TTL_MS))

    return {
      status: 200,
      body: {
        count
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/events'
  })
  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async events(req: Request): Promise<Response> {
    const { startDate: startDateQuery, endDate: endDateQuery } = req.query
    const game: Game = req.ctx.state.game
    const includeDevData = req.ctx.state.includeDevData
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    return withResponseCache({
      key: `events-${game.id}-${includeDevData}-${startDateQuery}-${endDateQuery}`,
      ttl: HEADLINES_CACHE_TTL_MS / 1000
    }, async () => {
      assert(startDateQuery)
      assert(endDateQuery)
      const startDate = formatDateForClickHouse(startOfDay(new Date(startDateQuery)))
      const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

      let query = `
        SELECT count() AS count
        FROM events
        WHERE created_at BETWEEN '${startDate}' AND '${endDate}'
          AND game_id = ${game.id}
      `

      if (!includeDevData) {
        query += 'AND dev_build = false'
      }

      const result = await clickhouse.query({
        query,
        format: 'JSONEachRow'
      }).then((res) => res.json<{ count: string }>())
      assert(result[0])

      return {
        status: 200,
        body: {
          count: Number(result[0].count)
        }
      }
    })
  }

  @Route({
    method: 'GET',
    path: '/unique_event_submitters'
  })
  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async uniqueEventSubmitters(req: Request): Promise<Response> {
    const { startDate: startDateQuery, endDate: endDateQuery } = req.query
    const game: Game = req.ctx.state.game
    const includeDevData = req.ctx.state.includeDevData
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    return withResponseCache({
      key: `unique-event-submitters-${game.id}-${includeDevData}-${startDateQuery}-${endDateQuery}`,
      ttl: HEADLINES_CACHE_TTL_MS / 1000
    }, async () => {
      assert(startDateQuery)
      assert(endDateQuery)
      const startDate = formatDateForClickHouse(startOfDay(new Date(startDateQuery)))
      const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

      let query = `
        SELECT count(DISTINCT player_alias_id) AS uniqueSubmitters
        FROM events
        WHERE created_at BETWEEN '${startDate}' AND '${endDate}'
          AND game_id = ${game.id}
      `

      if (!includeDevData) {
        query += 'AND dev_build = false'
      }

      const result = await clickhouse.query({
        query,
        format: 'JSONEachRow'
      }).then((res) => res.json<{ uniqueSubmitters: string }>())
      assert(result[0])

      return {
        status: 200,
        body: {
          count: Number(result[0].uniqueSubmitters)
        }
      }
    })
  }

  @Route({
    method: 'GET',
    path: '/total_players'
  })
  @HasPermission(HeadlinePolicy, 'index')
  async totalPlayers(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const game: Game = req.ctx.state.game
    const includeDevData = req.ctx.state.includeDevData
    const count = await em.getRepository(Player).count({
      game,
      ...(includeDevData ? {} : { devBuild: false })
    }, getResultCacheOptions(`total-players-${game.id}-${includeDevData}`, HEADLINES_CACHE_TTL_MS))

    return {
      status: 200,
      body: {
        count
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/online_players'
  })
  @HasPermission(HeadlinePolicy, 'index')
  async onlinePlayers(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const game: Game = req.ctx.state.game
    const includeDevData = req.ctx.state.includeDevData
    const count = await em.getRepository(Player).count({
      game,
      ...(includeDevData ? {} : { devBuild: false }),
      presence: {
        online: true
      }
    }, getResultCacheOptions(`online-players-${game.id}-${includeDevData}`, ONLINE_PLAYERS_CACHE_TTL_MS))

    return {
      status: 200,
      body: {
        count
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/total_sessions'
  })
  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async totalSessions(req: Request): Promise<Response> {
    const { startDate: startDateQuery, endDate: endDateQuery } = req.query
    const game: Game = req.ctx.state.game
    const includeDevData = req.ctx.state.includeDevData
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    return withResponseCache({
      key: `total-sessions-${game.id}-${includeDevData}-${startDateQuery}-${endDateQuery}`,
      ttl: HEADLINES_CACHE_TTL_MS / 1000
    }, async () => {
      assert(startDateQuery)
      assert(endDateQuery)
      const startDate = formatDateForClickHouse(startOfDay(new Date(startDateQuery)))
      const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

      let query = `
        SELECT count() AS count
        FROM player_sessions
        WHERE started_at BETWEEN '${startDate}' AND '${endDate}'
          AND game_id = ${game.id}
      `

      if (!includeDevData) {
        query += ' AND dev_build = false'
      }

      const result = await clickhouse.query({
        query,
        format: 'JSONEachRow'
      }).then((res) => res.json<{ count: string }>())
      assert(result[0])

      return {
        status: 200,
        body: {
          count: Number(result[0].count)
        }
      }
    })
  }

  @Route({
    method: 'GET',
    path: '/average_session_duration'
  })
  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async averageSessionDuration(req: Request): Promise<Response> {
    const { startDate: startDateQuery, endDate: endDateQuery } = req.query
    const game: Game = req.ctx.state.game
    const includeDevData = req.ctx.state.includeDevData
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    return withResponseCache({
      key: `average-session-duration-${game.id}-${includeDevData}-${startDateQuery}-${endDateQuery}`,
      ttl: HEADLINES_CACHE_TTL_MS / 1000
    }, async () => {
      assert(startDateQuery)
      assert(endDateQuery)
      const startDate = formatDateForClickHouse(startOfDay(new Date(startDateQuery)))
      const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

      let query = `
        SELECT avg(dateDiff('seconds', started_at, ended_at)) AS averageDuration
        FROM player_sessions
        WHERE started_at BETWEEN '${startDate}' AND '${endDate}'
          AND ended_at IS NOT NULL
          AND game_id = ${game.id}
      `

      if (!includeDevData) {
        query += ' AND dev_build = false'
      }

      const result = await clickhouse.query({
        query,
        format: 'JSONEachRow'
      }).then((res) => res.json<{ averageDuration: number }>())

      assert(result[0])
      const seconds = result[0].averageDuration

      return {
        status: 200,
        body: {
          hours: Math.floor(seconds / 3600),
          minutes: Math.floor((seconds % 3600) / 60),
          seconds: seconds % 60
        }
      }
    })
  }
}
