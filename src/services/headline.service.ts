import { FilterQuery, EntityManager } from '@mikro-orm/mysql'
import { endOfDay, isSameDay, startOfDay } from 'date-fns'
import { Service, Request, Response, Validate, HasPermission, Route } from 'koa-clay'
import Player from '../entities/player'
import HeadlinePolicy from '../policies/headline.policy'
import dateValidationSchema from '../lib/dates/dateValidationSchema'
import { devDataPlayerFilter } from '../middlewares/dev-data-middleware'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import { ClickHouseClient } from '@clickhouse/client'

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

    let where: FilterQuery<Player> = {
      game: req.ctx.state.game,
      createdAt: {
        $gte: startOfDay(new Date(startDate)),
        $lte: endOfDay(new Date(endDate))
      }
    }

    if (!req.ctx.state.includeDevData) {
      where = Object.assign(where, devDataPlayerFilter(em))
    }

    const players = await em.getRepository(Player).find(where)

    return {
      status: 200,
      body: {
        count: players.length
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

    let where: FilterQuery<Player> = {
      game: req.ctx.state.game,
      lastSeenAt: {
        $gte: startOfDay(new Date(startDate)),
        $lte: endOfDay(new Date(endDate))
      },
      createdAt: {
        $lt: startOfDay(new Date(startDate))
      }
    }

    if (!req.ctx.state.includeDevData) {
      where = Object.assign(where, devDataPlayerFilter(em))
    }

    let players = await em.getRepository(Player).find(where)
    players = players.filter((player) => !isSameDay(new Date(player.createdAt), new Date(player.lastSeenAt)))

    return {
      status: 200,
      body: {
        count: players.length
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

    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const startDate = formatDateForClickHouse(startOfDay(new Date(startDateQuery)))
    const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

    let query = `
      SELECT count() AS count
      FROM events
      WHERE created_at BETWEEN '${startDate}' AND '${endDate}'
        AND game_id = ${req.ctx.state.game.id}
    `

    if (!req.ctx.state.includeDevData) {
      query += 'AND dev_build = false'
    }

    const result = await clickhouse.query({
      query,
      format: 'JSONEachRow'
    }).then((res) => res.json<{ count: string }>())

    return {
      status: 200,
      body: {
        count: Number(result[0].count)
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/unique_event_submitters'
  })
  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async uniqueEventSubmitters(req: Request): Promise<Response> {
    const { startDate: startDateQuery, endDate: endDateQuery } = req.query

    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const startDate = formatDateForClickHouse(startOfDay(new Date(startDateQuery)))
    const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

    let query = `
      SELECT count(DISTINCT player_alias_id) AS uniqueSubmitters
      FROM events
      WHERE created_at BETWEEN '${startDate}' AND '${endDate}'
        AND game_id = ${req.ctx.state.game.id}
    `

    if (!req.ctx.state.includeDevData) {
      query += 'AND dev_build = false'
    }

    const result = await clickhouse.query({
      query,
      format: 'JSONEachRow'
    }).then((res) => res.json<{ uniqueSubmitters: string }>())

    return {
      status: 200,
      body: {
        count: Number(result[0].uniqueSubmitters)
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/total_players'
  })
  @HasPermission(HeadlinePolicy, 'index')
  async totalPlayers(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    let where: FilterQuery<Player> = {
      game: req.ctx.state.game
    }

    if (!req.ctx.state.includeDevData) {
      where = Object.assign(where, devDataPlayerFilter(em))
    }

    const count = await em.getRepository(Player).count(where)

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

    let where: FilterQuery<Player> = {
      game: req.ctx.state.game,
      presence: {
        online: true
      }
    }

    if (!req.ctx.state.includeDevData) {
      where = Object.assign(where, devDataPlayerFilter(em))
    }

    const count = await em.getRepository(Player).count(where)

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

    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const startDate = formatDateForClickHouse(startOfDay(new Date(startDateQuery)))
    const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

    let query = `
      SELECT count() AS count
      FROM player_sessions
      WHERE started_at BETWEEN '${startDate}' AND '${endDate}'
        AND game_id = ${req.ctx.state.game.id}
    `

    if (!req.ctx.state.includeDevData) {
      query += ' AND dev_build = false'
    }

    const result = await clickhouse.query({
      query,
      format: 'JSONEachRow'
    }).then((res) => res.json<{ count: string }>())

    return {
      status: 200,
      body: {
        count: Number(result[0].count)
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/average_session_duration'
  })
  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async averageSessionDuration(req: Request): Promise<Response> {
    const { startDate: startDateQuery, endDate: endDateQuery } = req.query

    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const startDate = formatDateForClickHouse(startOfDay(new Date(startDateQuery)))
    const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

    let query = `
      SELECT avg(dateDiff('seconds', started_at, ended_at)) AS averageDuration
      FROM player_sessions
      WHERE started_at BETWEEN '${startDate}' AND '${endDate}'
        AND ended_at IS NOT NULL
        AND game_id = ${req.ctx.state.game.id}
    `

    if (!req.ctx.state.includeDevData) {
      query += ' AND dev_build = false'
    }

    const result = await clickhouse.query({
      query,
      format: 'JSONEachRow'
    }).then((res) => res.json<{ averageDuration: number }>())

    const seconds = result[0].averageDuration

    return {
      status: 200,
      body: {
        hours: Math.floor(seconds / 3600),
        minutes: Math.floor((seconds % 3600) / 60),
        seconds: seconds % 60
      }
    }
  }
}
