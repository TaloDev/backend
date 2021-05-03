import { EntityManager } from '@mikro-orm/core'
import { Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Game from '../entities/game'
import getUserFromToken from '../lib/auth/getUserFromToken'

export default class GamesService implements Service {
  @Validate({
    body: ['name']
  })
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { name } = req.body
    const em: EntityManager = req.ctx.em
    const user = await getUserFromToken(req.ctx)
    
    const game = new Game(name, user.organisation)
    await em.persistAndFlush(game)

    return {
      status: 200,
      body: {
        game
      }
    }
  }
}
