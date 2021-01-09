import { EntityManager } from '@mikro-orm/core'
import { Resource, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Game from '../entities/game'
import Team from '../entities/team'
import GameResource from '../resources/game-resource'

export default class GamesService implements Service {
  @Validate({
    body: {
      name: 'Missing body parameter: name',
      teamId: 'Missing body parameter: teamId'
    }
  })
  @Resource(GameResource, 'game')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { name, teamId } = req.body
    const em: EntityManager = req.ctx.em
    
    const game = new Game(name)
    game.team = await em.getRepository(Team).findOne(teamId)

    if (!game.team) {
      req.ctx.throw(400, 'The specified team doesn\'t exist')
    }

    await em.persistAndFlush(game)

    return {
      status: 200,
      body: {
        game
      }
    }
  }
}
