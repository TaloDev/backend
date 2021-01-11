import { EntityManager } from '@mikro-orm/core'
import { Resource, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import Game from '../../entities/game'
import Team from '../../entities/team'
import GameResource from '../../resources/game.resource'
import APIService from './api-service'

export default class GamesAPIService extends APIService {
  constructor(serviceName: string) {
    super(serviceName)
  }

  @Validate({
    body: {
      name: 'Missing body parameter: name',
      team: 'Missing body parameter: team'
    }
  })
  @Resource(GameResource, 'game')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { name, team } = req.body
    const em: EntityManager = req.ctx.em
    
    const game = new Game(name)
    game.team = await em.getRepository(Team).findOne(team)

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
