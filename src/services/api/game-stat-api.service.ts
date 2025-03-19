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
import PlayerGameStatSnapshot, { ClickHousePlayerGameStatSnapshot, createPlayerGameStatSnapshotFromClickHouse } from '../../entities/player-game-stat-snapshot'
import Player from '../../entities/player'
import { buildDateValidationSchema } from '../../lib/dates/dateValidationSchema'
import { formatDateForClickHouse } from '../../lib/clickhouse/formatDateTime'

export default class GameStatAPIService extends APIService {
  @Route({
    method: 'PUT',
    path: '/:internalName',
    docs: GameStatAPIDocs.put
  })
  @Validate({
    headers: ['x-talo-player'],
    body: ['change']
  })
  @HasPermission(GameStatAPIPolicy, 'put')
  async put(req: Request<{ change: number }>): Promise<Response> {
    const { change } = req.body
    const em: EntityManager = req.ctx.em
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const stat: GameStat = req.ctx.state.stat
    const player: Player = req.ctx.state.player

    let playerStat = await em.getRepository(PlayerGameStat).findOne({ player, stat })

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
      playerStat = new PlayerGameStat(req.ctx.state.player, req.ctx.state.stat)
      if (req.ctx.state.continuityDate) {
        playerStat.createdAt = req.ctx.state.continuityDate
      }

      em.persist(playerStat)
    }

    playerStat.value += change
    if (stat.global) stat.globalValue += change

    const snapshot = new PlayerGameStatSnapshot(playerStat)
    snapshot.change = change

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: [snapshot.getInsertableData()],
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

    let whereConditions = `WHERE game_stat_id = ${stat.id} AND player_id = '${player.id}'`
    if (startDate) {
      whereConditions += ` AND created_at >= '${formatDateForClickHouse(new Date(startDate))}'`
    }
    if (endDate) {
      // when using YYYY-MM-DD, use the end of the day
      const end = endDate.length === 10 ? endOfDay(new Date(endDate)) : new Date(endDate)
      whereConditions += ` AND created_at <= '${formatDateForClickHouse(end)}'`
    }

    const query = `
      WITH (SELECT COUNT() FROM player_game_stat_snapshots ${whereConditions}) AS count
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
    const history = await Promise.all(snapshots.map((snapshot) => createPlayerGameStatSnapshotFromClickHouse(em, snapshot)))

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
}
