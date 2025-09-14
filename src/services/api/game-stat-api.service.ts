import { EntityManager } from '@mikro-orm/mysql'
import { differenceInSeconds } from 'date-fns'
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
import PlayerAlias from '../../entities/player-alias'
import { FlushStatSnapshotsQueueHandler } from '../../lib/queues/game-metrics/flush-stat-snapshots-queue-handler'
import { pageValidation } from '../../lib/pagination/pageValidation'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination/itemsPerPage'

export default class GameStatAPIService extends APIService {
  private queueHandler: FlushStatSnapshotsQueueHandler

  constructor() {
    super()
    this.queueHandler = new FlushStatSnapshotsQueueHandler()
  }

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
    method: 'GET',
    path: '/:internalName/player-stat',
    docs: GameStatAPIDocs.getPlayerStat
  })
  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameStatAPIPolicy, 'getPlayerStat')
  async getPlayerStat(req: Request) : Promise<Response> {
    const em: EntityManager = req.ctx.em

    const stat: GameStat = req.ctx.state.stat
    const alias: PlayerAlias = req.ctx.state.alias
    const playerStat = await em.repo(PlayerGameStat).findOne({
      player: alias.player,
      stat
    })

    return {
      status: 200,
      body: {
        playerStat
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

    const stat: GameStat = req.ctx.state.stat
    const alias: PlayerAlias = req.ctx.state.alias

    let playerStat = await em.repo(PlayerGameStat).findOne({
      player: alias.player,
      stat
    })

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

    const continuityDate: Date = req.ctx.state.continuityDate

    if (!playerStat) {
      playerStat = new PlayerGameStat(alias.player, req.ctx.state.stat)
      if (continuityDate) {
        playerStat.createdAt = continuityDate
      }

      em.persist(playerStat)
    }

    playerStat.value += change
    if (stat.global) stat.globalValue += change

    const snapshot = new PlayerGameStatSnapshot()
    snapshot.construct(alias, playerStat)
    snapshot.change = change
    if (continuityDate) {
      snapshot.createdAt = continuityDate
    }

    await this.queueHandler.add(snapshot)

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
      page: pageValidation,
      ...buildDateValidationSchema(false, false)
    }
  })
  @HasPermission(GameStatAPIPolicy, 'history')
  async history(req: Request): Promise<Response> {
    const itemsPerPage = DEFAULT_PAGE_SIZE
    const { page = 0, startDate, endDate } = req.query

    const em: EntityManager = req.ctx.em
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const stat: GameStat = req.ctx.state.stat
    const player: Player = req.ctx.state.player

    const whereConditions = await stat.buildMetricsWhereConditions(startDate, endDate, player)

    const query = `
      WITH (SELECT count() FROM player_game_stat_snapshots ${whereConditions}) AS count
      SELECT *, count
      FROM player_game_stat_snapshots
      ${whereConditions}
      ORDER BY created_at DESC
      LIMIT ${itemsPerPage + 1} OFFSET ${Number(page) * itemsPerPage}
    `

    const snapshots = await clickhouse.query({
      query,
      format: 'JSONEachRow'
    }).then((res) => res.json<ClickHousePlayerGameStatSnapshot & { count: string }>())

    const count = Number(snapshots[0]?.count ?? 0)
    const history = await PlayerGameStatSnapshot.massHydrate(em, snapshots.slice(0, itemsPerPage))

    return {
      status: 200,
      body: {
        history,
        count,
        itemsPerPage,
        isLastPage: snapshots.length <= itemsPerPage
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
      page: pageValidation,
      ...buildDateValidationSchema(false, false)
    }
  })
  @HasPermission(GameStatAPIPolicy, 'globalHistory')
  async globalHistory(req: Request): Promise<Response> {
    const itemsPerPage = DEFAULT_PAGE_SIZE
    const { page = 0, startDate, endDate, playerId } = req.query

    const em: EntityManager = req.ctx.em
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const stat: GameStat = req.ctx.state.stat
    if (!stat.global) {
      req.ctx.throw(400, 'This stat is not globally available')
    }

    let whereConditions = await stat.buildMetricsWhereConditions(startDate, endDate)

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
      LIMIT ${itemsPerPage + 1} OFFSET ${Number(page) * itemsPerPage}
    `

    const snapshots = await clickhouse.query({
      query,
      format: 'JSONEachRow'
    }).then((res) => res.json<ClickHousePlayerGameStatSnapshot>())

    const history = await PlayerGameStatSnapshot.massHydrate(em, snapshots.slice(0, itemsPerPage))
    const [count, globalValue] = await stat.getGlobalValueMetrics(clickhouse, whereConditions)
    const playerValue = await stat.getPlayerValueMetrics(clickhouse, whereConditions)

    return {
      status: 200,
      body: {
        history,
        globalValue,
        playerValue,
        count,
        itemsPerPage,
        isLastPage: snapshots.length <= itemsPerPage
      }
    }
  }
}
