import { EntityManager } from '@mikro-orm/mysql'
import { differenceInSeconds, endOfDay } from 'date-fns'
import { HasPermission, Request, Response, Route, Validate } from 'koa-clay'
import GameStatAPIDocs from '../../docs/game-stat-api.docs'
import GameStat from '../../entities/game-stat'
import PlayerGameStat from '../../entities/player-game-stat'
import triggerIntegrations from '../../lib/integrations/triggerIntegrations'
import GameStatAPIPolicy from '../../policies/api/game-stat-api.policy'
import APIService from './api-service'
import { ClickHouseClient } from '@clickhouse/client'
import PlayerGameStatSnapshot, { ClickHousePlayerGameStatSnapshot } from '../../entities/player-game-stat-snapshot'
import Player from '../../entities/player'
import { buildDateValidationSchema } from '../../lib/dates/dateValidationSchema'
import { formatDateForClickHouse } from '../../lib/clickhouse/formatDateTime'
import PlayerAlias from '../../entities/player-alias'
import { TraceService } from '../../lib/routing/trace-service'

type GlobalValueMetrics = {
  minValue: number
  maxValue: number
  medianValue: number
  averageValue: number
  averageChange: number
}

type PlayerValueMetrics = {
  minValue: number
  maxValue: number
  medianValue: number
  averageValue: number
}

async function getGlobalValueMetrics(
  clickhouse: ClickHouseClient,
  stat: GameStat,
  whereConditions: string
): Promise<[number, GlobalValueMetrics]> {
  const query = `
    SELECT
      count() as rawCount,
      min(global_value) as minValue,
      max(global_value) as maxValue,
      median(global_value) as medianValue,
      avg(global_value) as averageValue,
      avg(change) as averageChange
    FROM player_game_stat_snapshots
    ${whereConditions}
  `

  const res = await clickhouse.query({
    query: query,
    format: 'JSONEachRow'
  }).then((res) => res.json<{
    rawCount: string | number
    minValue: number
    maxValue: number
    medianValue: number | null
    averageValue: number | null
    averageChange: number | null
  }>())

  const {
    rawCount,
    minValue,
    maxValue,
    medianValue,
    averageValue,
    averageChange
  } = res[0]

  return [
    Number(rawCount),
    {
      minValue: minValue || stat.defaultValue,
      maxValue: maxValue || stat.defaultValue,
      medianValue: medianValue ?? stat.defaultValue,
      averageValue: averageValue ?? stat.defaultValue,
      averageChange: averageChange ?? 0
    }
  ]
}

async function getPlayerValueMetrics(
  clickhouse: ClickHouseClient,
  stat: GameStat,
  whereConditions: string
): Promise<PlayerValueMetrics> {
  const query = `
    SELECT
      min(value) as minValue,
      max(value) as maxValue,
      median(value) as medianValue,
      avg(value) as averageValue
    FROM player_game_stat_snapshots
    ${whereConditions}
  `

  const res = await clickhouse.query({
    query: query,
    format: 'JSONEachRow'
  }).then((res) => res.json<{
    minValue: number
    maxValue: number
    medianValue: number | null
    averageValue: number | null
  }>())

  const {
    minValue,
    maxValue,
    medianValue,
    averageValue
  } = res[0]

  return {
    minValue: minValue || stat.defaultValue,
    maxValue: maxValue || stat.defaultValue,
    medianValue: medianValue ?? stat.defaultValue,
    averageValue: averageValue ?? stat.defaultValue
  }
}

@TraceService()
export default class GameStatAPIService extends APIService {
  @Route({
    method: 'GET',
    docs: GameStatAPIDocs.index
  })
  @HasPermission(GameStatAPIPolicy, 'index')
  async index(req: Request) : Promise<Response> {
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)
    const stats = await em.repo(GameStat).find({ game: key.game })

    return {
      status: 200,
      body: {
        stats
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/:internalName',
    docs: GameStatAPIDocs.get
  })
  @HasPermission(GameStatAPIPolicy, 'get')
  async get(req: Request) : Promise<Response> {
    return {
      status: 200,
      body: {
        stat: req.ctx.state.stat
      }
    }

  }

  @Route({
    method: 'PUT',
    path: '/:internalName',
    docs: GameStatAPIDocs.put
  })
  @Validate({
    headers: ['x-talo-alias'],
    body: ['change']
  })
  @HasPermission(GameStatAPIPolicy, 'put')
  async put(req: Request<{ change: number }>): Promise<Response> {
    const { change } = req.body
    const em: EntityManager = req.ctx.em
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const stat: GameStat = req.ctx.state.stat
    const alias: PlayerAlias = req.ctx.state.alias

    let playerStat = await em.repo(PlayerGameStat).findOne({ player: alias.player, stat })

    if (playerStat && differenceInSeconds(new Date(), playerStat.createdAt) < stat.minTimeBetweenUpdates) {
      req.ctx.throw(400, `Stat cannot be updated more often than every ${stat.minTimeBetweenUpdates} seconds`)
    }

    if (Math.abs(change) > (stat.maxChange ?? Infinity)) {
      req.ctx.throw(400, `Stat change cannot be more than ${stat.maxChange}`)
    }

    const currentValue = playerStat?.value ?? stat.defaultValue

    if (currentValue + change < (stat.minValue ?? -Infinity)) {
      req.ctx.throw(400, `Stat would go below the minValue of ${stat.minValue}`)
    }

    if (currentValue + change > (stat.maxValue ?? Infinity)) {
      req.ctx.throw(400, `Stat would go above the maxValue of ${stat.maxValue}`)
    }

    if (!playerStat) {
      playerStat = new PlayerGameStat(alias.player, req.ctx.state.stat)
      if (req.ctx.state.continuityDate) {
        playerStat.createdAt = req.ctx.state.continuityDate
      }

      em.persist(playerStat)
    }

    playerStat.value += change
    if (stat.global) stat.globalValue += change

    const snapshot = new PlayerGameStatSnapshot()
    snapshot.construct(alias, playerStat)
    snapshot.change = change

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: [snapshot.toInsertable()],
      format: 'JSONEachRow'
    })

    await triggerIntegrations(em, stat.game, (integration) => {
      return integration.handleStatUpdated(em, playerStat)
    })

    await em.flush()

    return {
      status: 200,
      body: {
        playerStat
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/:internalName/history',
    docs: GameStatAPIDocs.history
  })
  @Validate({
    headers: ['x-talo-player'],
    query: {
      page: {
        required: true
      },
      ...buildDateValidationSchema(false, false)
    }
  })
  @HasPermission(GameStatAPIPolicy, 'history')
  async history(req: Request): Promise<Response> {
    const itemsPerPage = 50
    const { page, startDate, endDate } = req.query

    const em: EntityManager = req.ctx.em
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const stat: GameStat = req.ctx.state.stat
    const player: Player = req.ctx.state.player

    await player.aliases.loadItems()
    const aliasIds = player.aliases.getIdentifiers()

    let whereConditions = `WHERE game_stat_id = ${stat.id} AND player_alias_id IN (${aliasIds.join(', ')})`
    if (startDate) {
      whereConditions += ` AND created_at >= '${formatDateForClickHouse(new Date(startDate))}'`
    }
    if (endDate) {
      // when using YYYY-MM-DD, use the end of the day
      const end = endDate.length === 10 ? endOfDay(new Date(endDate)) : new Date(endDate)
      whereConditions += ` AND created_at <= '${formatDateForClickHouse(end)}'`
    }

    const query = `
      WITH (SELECT count() FROM player_game_stat_snapshots ${whereConditions}) AS count
      SELECT *, count
      FROM player_game_stat_snapshots
      ${whereConditions}
      ORDER BY created_at DESC
      LIMIT ${itemsPerPage} OFFSET ${Number(page) * itemsPerPage}
    `

    const snapshots = await clickhouse.query({
      query,
      format: 'JSONEachRow'
    }).then((res) => res.json<ClickHousePlayerGameStatSnapshot & { count: string }>())

    const count = Number(snapshots[0]?.count ?? 0)
    const history = await Promise.all(snapshots.map((snapshot) => new PlayerGameStatSnapshot().hydrate(em, snapshot)))

    return {
      status: 200,
      body: {
        history,
        count,
        itemsPerPage,
        isLastPage: (Number(page) * itemsPerPage) + itemsPerPage >= count
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/:internalName/global-history',
    docs: GameStatAPIDocs.globalHistory
  })
  @Validate({
    query: {
      page: {
        required: true
      },
      ...buildDateValidationSchema(false, false)
    }
  })
  @HasPermission(GameStatAPIPolicy, 'globalHistory')
  async globalHistory(req: Request): Promise<Response> {
    const itemsPerPage = 50
    const { page, startDate, endDate, playerId } = req.query

    const em: EntityManager = req.ctx.em
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const stat: GameStat = req.ctx.state.stat
    if (!stat.global) {
      req.ctx.throw(400, 'This stat is not globally available')
    }

    let whereConditions = `WHERE game_stat_id = ${stat.id}`
    if (startDate) {
      whereConditions += ` AND created_at >= '${formatDateForClickHouse(new Date(startDate))}'`
    }
    if (endDate) {
      // when using YYYY-MM-DD, use the end of the day
      const end = endDate.length === 10 ? endOfDay(new Date(endDate)) : new Date(endDate)
      whereConditions += ` AND created_at <= '${formatDateForClickHouse(end)}'`
    }
    if (playerId) {
      try {
        const player = await em.repo(Player).findOneOrFail({
          id: playerId,
          game: stat.game
        }, { populate: ['aliases'] })
        whereConditions += ` AND player_alias_id IN (${player.aliases.getIdentifiers().join(', ')})`
      } catch (err) {
        req.ctx.throw(404, 'Player not found')
      }
    }

    const query = `
      SELECT *
      FROM player_game_stat_snapshots
      ${whereConditions}
      ORDER BY created_at DESC
      LIMIT ${itemsPerPage} OFFSET ${Number(page) * itemsPerPage}
    `

    const snapshots = await clickhouse.query({
      query,
      format: 'JSONEachRow'
    }).then((res) => res.json<ClickHousePlayerGameStatSnapshot>())

    const history = await Promise.all(snapshots.map((snapshot) => new PlayerGameStatSnapshot().hydrate(em, snapshot)))
    const [count, globalValue] = await getGlobalValueMetrics(clickhouse, stat, whereConditions)
    const playerValue = await getPlayerValueMetrics(clickhouse, stat, whereConditions)

    return {
      status: 200,
      body: {
        history,
        globalValue,
        playerValue,
        count,
        itemsPerPage,
        isLastPage: (Number(page) * itemsPerPage) + itemsPerPage >= count
      }
    }
  }
}
