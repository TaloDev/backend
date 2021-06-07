import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Game from '../entities/game'
import getUserFromToken from '../lib/auth/getUserFromToken'
import GamesPolicy from '../policies/games.policy'

export default class GamesService implements Service {
  @HasPermission(GamesPolicy, 'post')
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
