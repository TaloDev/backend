import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate } from 'koa-clay'
import { GameActivityType } from '../entities/game-activity'
import GameStat from '../entities/game-stat'
import createGameActivity from '../lib/logging/createGameActivity'
import GameStatPolicy from '../policies/game-stat.policy'
import handleSQLError from '../lib/errors/handleSQLError'

export default class GameStatService extends Service {
  @HasPermission(GameStatPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const stats = await em.getRepository(GameStat).find({ game: req.ctx.state.game })

    for (const stat of stats) {
      if (stat.global) {
        await stat.recalculateGlobalValue(req.ctx.state.includeDevData)
      }
    }

    return {
      status: 200,
      body: {
        stats
      }
    }
  }

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
      return handleSQLError(err)
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

  @Validate({
    body: [GameStat]
  })
  @HasPermission(GameStatPolicy, 'put')
  async put(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const stat: GameStat = req.ctx.state.stat

    const updateableKeys: (keyof GameStat)[] = ['name', 'global', 'maxChange', 'minValue', 'maxValue', 'defaultValue', 'minTimeBetweenUpdates']
    const changedProperties = []

    for (const key in req.body) {
      if (updateableKeys.includes(key as keyof GameStat)) {
        const original = stat[key]
        stat[key] = req.body[key]
        if (original !== stat[key]) changedProperties.push(key)
      }
    }

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
      return handleSQLError(err)
    }

    return {
      status: 200,
      body: {
        stat
      }
    }
  }

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
}
