import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate, Route } from 'koa-clay'
import { GameActivityType } from '../entities/game-activity'
import GameStat from '../entities/game-stat'
import createGameActivity from '../lib/logging/createGameActivity'
import GameStatPolicy from '../policies/game-stat.policy'
import handleSQLError from '../lib/errors/handleSQLError'
import PlayerGameStat from '../entities/player-game-stat'
import triggerIntegrations from '../lib/integrations/triggerIntegrations'
import updateAllowedKeys from '../lib/entities/updateAllowedKeys'
import { buildDateValidationSchema } from '../lib/dates/dateValidationSchema'
import { withResponseCache } from '../lib/perf/responseCache'
import Game from '../entities/game'

export default class GameStatService extends Service {
  @Route({
    method: 'GET'
  })
  @Validate({
    query: buildDateValidationSchema(false, false)
  })
  @HasPermission(GameStatPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const { withMetrics, metricsStartDate, metricsEndDate } = req.query

    const em: EntityManager = req.ctx.em
    const game: Game = req.ctx.state.game

    return withResponseCache({
      key: `stats-index-${game.id}-${withMetrics}-${metricsStartDate}-${metricsEndDate}`
    }, async () => {
      const stats = await em.repo(GameStat).find({ game })
      const globalStats = stats.filter((stat) => stat.global)

      if (globalStats.length > 0) {
        await Promise.allSettled(
          globalStats.map((stat) => stat.recalculateGlobalValue(req.ctx.state.includeDevData))
        )

        if (withMetrics === '1') {
          await Promise.allSettled(
            globalStats.map((stat) => stat.loadMetrics(req.ctx.clickhouse, metricsStartDate, metricsEndDate))
          )
        }
      }

      return {
        status: 200,
        body: {
          stats
        }
      }
    })
  }

  @Route({
    method: 'POST'
  })
  @Validate({
    body: [GameStat]
  })
  @HasPermission(GameStatPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { internalName, name, global, maxChange, minValue, maxValue, defaultValue, minTimeBetweenUpdates } = req.body
    const em: EntityManager = req.ctx.em

    const stat = new GameStat(req.ctx.state.game)
    stat.internalName = internalName
    stat.name = name

    stat.global = global
    stat.globalValue = stat.defaultValue = defaultValue

    stat.maxChange = maxChange
    stat.minValue = minValue
    stat.maxValue = maxValue
    stat.minTimeBetweenUpdates = minTimeBetweenUpdates

    try {
      await em.persistAndFlush(stat)
    } catch (err) {
      return handleSQLError(err as Error)
    }

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: stat.game,
      type: GameActivityType.GAME_STAT_CREATED,
      extra: {
        statInternalName: stat.internalName
      }
    })
    await em.flush()

    return {
      status: 200,
      body: {
        stat
      }
    }
  }

  @Route({
    method: 'PUT',
    path: '/:id'
  })
  @Validate({
    body: [GameStat]
  })
  @HasPermission(GameStatPolicy, 'put')
  async put(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const [stat, changedProperties] = updateAllowedKeys(
      req.ctx.state.stat as GameStat,
      req.body,
      ['name', 'global', 'maxChange', 'minValue', 'maxValue', 'defaultValue', 'minTimeBetweenUpdates']
    )

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: stat.game,
      type: GameActivityType.GAME_STAT_UPDATED,
      extra: {
        statInternalName: stat.internalName,
        display: {
          'Updated properties': changedProperties.map((prop) => `${prop}: ${req.body[prop]}`).join(', ')
        }
      }
    })

    try {
      await em.flush()
    } catch (err) {
      return handleSQLError(err as Error)
    }

    return {
      status: 200,
      body: {
        stat
      }
    }
  }

  @Route({
    method: 'DELETE',
    path: '/:id'
  })
  @HasPermission(GameStatPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.stat.game,
      type: GameActivityType.GAME_STAT_DELETED,
      extra: {
        statInternalName: req.ctx.state.stat.internalName
      }
    })

    await em.removeAndFlush(req.ctx.state.stat)

    return {
      status: 204
    }
  }

  @Route({
    method: 'PATCH',
    path: '/:id/player-stats/:playerStatId'
  })
  @HasPermission(GameStatPolicy, 'updatePlayerStat')
  @Validate({
    body: ['newValue']
  })
  async updatePlayerStat(req: Request): Promise<Response> {
    const { newValue } = req.body
    const em: EntityManager = req.ctx.em

    const playerStat: PlayerGameStat = req.ctx.state.playerStat
    const oldValue = playerStat.value

    if (newValue < (playerStat.stat.minValue ?? -Infinity)) {
      req.ctx.throw(400, `Stat would go below the minValue of ${playerStat.stat.minValue}`)
    }

    if (newValue > (playerStat.stat.maxValue ?? Infinity)) {
      req.ctx.throw(400, `Stat would go above the maxValue of ${playerStat.stat.maxValue}`)
    }

    playerStat.value = newValue
    if (playerStat.stat.global) {
      playerStat.stat.globalValue += newValue - oldValue
    }

    await triggerIntegrations(em, playerStat.player.game, (integration) => {
      return integration.handleStatUpdated(em, playerStat)
    })

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: playerStat.player.game,
      type: GameActivityType.PLAYER_STAT_UPDATED,
      extra: {
        statInternalName: playerStat.stat.internalName,
        display: {
          'Player': playerStat.player.id,
          'Stat': playerStat.stat.internalName,
          'Old value': oldValue,
          'New value': newValue
        }
      }
    })

    await em.flush()

    return {
      status: 200,
      body: {
        playerStat
      }
    }
  }
}
