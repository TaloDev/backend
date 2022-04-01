import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Service, Request, Response, Validate } from 'koa-clay'
import GameActivity from '../entities/game-activity'
import GameActivityPolicy from '../policies/game-activity.policy'

export default class GameActivityService implements Service {
  @Validate({
    query: ['gameId']
  })
  @HasPermission(GameActivityPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const activities = await em.getRepository(GameActivity).find({ game: req.ctx.state.game }, { populate: ['user'] })

    return {
      status: 200,
      body: {
        activities
      }
    }
  }
}
