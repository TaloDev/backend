import { FilterQuery, EntityManager } from '@mikro-orm/mysql'
import { endOfDay, isSameDay, startOfDay } from 'date-fns'
import { Service, Request, Response, Validate, HasPermission, Routes } from 'koa-clay'
import Player from '../entities/player'
import HeadlinePolicy from '../policies/headline.policy'
import dateValidationSchema from '../lib/dates/dateValidationSchema'
import { devDataPlayerFilter } from '../middlewares/dev-data-middleware'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import { NodeClickHouseClient } from '@clickhouse/client/dist/client'

@Routes([
  {
    method: 'GET',
    path: '/new_players',
    handler: 'newPlayers'
  },
  {
    method: 'GET',
    path: '/returning_players',
    handler: 'returningPlayers'
  },
  {
    method: 'GET',
    path: '/events',
    handler: 'events'
  },
  {
    method: 'GET',
    path: '/unique_event_submitters',
    handler: 'uniqueEventSubmitters'
  }
])
export default class HeadlineService extends Service {
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

  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async events(req: Request): Promise<Response> {
    const { startDate: startDateQuery, endDate: endDateQuery } = req.query

    const clickhouse: NodeClickHouseClient = req.ctx.clickhouse

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

  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async uniqueEventSubmitters(req: Request): Promise<Response> {
    const { startDate: startDateQuery, endDate: endDateQuery } = req.query

    const clickhouse: NodeClickHouseClient = req.ctx.clickhouse

    const startDate = formatDateForClickHouse(startOfDay(new Date(startDateQuery)))
    const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

    let query = `
      SELECT COUNT(DISTINCT player_alias_id) AS uniqueSubmitters
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
}
