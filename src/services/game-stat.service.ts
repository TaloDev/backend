import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Service, Request, Response, Validate } from 'koa-clay'
import { GameActivityType } from '../entities/game-activity'
import GameStat from '../entities/game-stat'
import createGameActivity from '../lib/logging/createGameActivity'
import GameStatPolicy from '../policies/game-stat.policy'

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

    await createGameActivity(em, {
      user: req.ctx.state.user,
      game: stat.game,
      type: GameActivityType.GAME_STAT_CREATED,
      extra: {
        statInternalName: stat.internalName
      }
    })

    await em.persistAndFlush(stat)

    return {
      status: 200,
      body: {
        stat
      }
    }
  }

  private updateStat(stat: GameStat, req: Request, property: string, type: string): boolean {
    if (typeof req.body[property] === type) {
      stat[property] = req.body[property]
      return true
    }

    return false
  }

  @Validate({
    body: [GameStat]
  })
  @HasPermission(GameStatPolicy, 'patch')
  async patch(req: Request): Promise<Response> {
    const properties = ['name', 'global', 'maxChange', 'minValue', 'maxValue', 'defaultValue', 'minTimeBetweenUpdates']
    const em: EntityManager = req.ctx.em

    const changedProperties = []

    const stat = req.ctx.state.stat
    for (const property of properties) {
      switch (property) {
        case 'name':
          if (this.updateStat(stat, req, property, 'string')) changedProperties.push(property)
          break
        case 'global':
          if (this.updateStat(stat, req, property, 'boolean')) changedProperties.push(property)
          break
        default:
          if (this.updateStat(stat, req, property, 'number')) changedProperties.push(property)
      }
    }

    await createGameActivity(em, {
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

    await em.flush()

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

    await createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.stat.game,
      type: GameActivityType.GAME_STAT_DELETED,
      extra: {
        statInternalName: req.ctx.state.stat.internalName
      }
    })

    await em.getRepository(GameStat).removeAndFlush(req.ctx.state.stat)

    return {
      status: 204
    }
  }
}
