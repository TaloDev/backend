import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import GameActivity from '../entities/game-activity'
import GameActivitysPolicy from '../policies/game-activities.policy'

export default class GameActivitysService implements Service {
  @Validate({
    query: ['gameId']
  })
  @HasPermission(GameActivitysPolicy, 'index')
  async index(req: ServiceRequest): Promise<ServiceResponse> {
    const em: EntityManager = req.ctx.em
    const activities = await em.getRepository(GameActivity).find({ game: req.ctx.state.game })

    return {
      status: 200,
      body: {
        activities
      }
    }
  }
}
