import { EntityManager } from '@mikro-orm/core'
import { Resource, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Game from '../entities/game'
import GameResource from '../resources/game.resource'

export default class GamesService implements Service {
  @Validate({
    body: ['name']
  })
  @Resource(GameResource, 'game')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { name } = req.body
    const em: EntityManager = req.ctx.em
    
    const game = new Game(name)
    await em.persistAndFlush(game)

    return {
      status: 200,
      body: {
        game
      }
    }
  }
}
