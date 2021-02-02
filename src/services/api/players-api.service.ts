import { EntityManager, expr } from '@mikro-orm/core'
import { Resource, ServiceRequest, ServiceResponse, ServiceRoute, Validate, HasPermission } from 'koa-rest-services'
import Player from '../../entities/player'
import PlayersAPIPolicy from '../../lib/policies/api/players-api.policy'
import PlayerResource from '../../resources/player.resource'
import PlayersService from '../players.service'
import APIService from './api-service'

export const playerAPIRoutes: ServiceRoute[] = [
  {
    method: 'GET'
  },
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
    query: ['alias', 'id']
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

  @HasPermission(PlayersAPIPolicy, 'get')
  @Validate({
    query: ['gameId']
  })
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    return await this.getService<PlayersService>(req).get(req)
  }

  @Validate({
    body: ['gameId']
  })
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    return await this.getService<PlayersService>(req).post(req)
  }
}
