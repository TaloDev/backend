import { EntityManager, expr } from '@mikro-orm/core'
import { Resource, ServiceRequest, ServiceResponse, ServiceRoute, Validate } from 'koa-rest-services'
import Player from '../../entities/player'
import PlayerResource from '../../resources/player.resource'
import PlayersService from '../players.service'
import APIService from './api-service'

export const playerAPIRoutes: ServiceRoute[] = [
  {
    method: 'GET',
    path: '/identify',
    handler: 'identify'
  },
  {
    method: 'POST'
  }
]

export default class PlayersAPIService extends APIService {
  constructor(serviceName: string) {
    super(serviceName)
  }

  @Validate({
    query: {
      alias: 'Missing query parameter: alias',
      id: 'Missing query parameter: id'
    }
  })
  @Resource(PlayerResource, 'player')
  async identify(req: ServiceRequest): Promise<ServiceResponse> {
    const { alias, id } = req.query
    const em: EntityManager = req.ctx.em

    const player = await em.getRepository(Player).findOne({
      [expr(`json_extract(aliases, '$.${alias}')`)]: id
    })

    if (!player) {
      req.ctx.throw(404, 'User not found')
    }

    player.lastSeenAt = new Date()
    await em.flush()

    return {
      status: 200,
      body: {
        player
      }
    }
  }

  async post(req: ServiceRequest): Promise<ServiceResponse> {
    return await this.getService<PlayersService>(req).post(req)
  }
}
