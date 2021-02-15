import { EntityManager, expr } from '@mikro-orm/core'
import { Resource, ServiceRequest, ServiceResponse, ServiceRoute, Validate, HasPermission } from 'koa-rest-services'
import APIKey from '../../entities/api-key'
import Player from '../../entities/player'
import PlayersAPIPolicy from '../../lib/policies/api/players-api.policy'
import PlayerResource from '../../resources/player.resource'
import PlayersService from '../players.service'
import APIService from './api-service'

export const playersAPIRoutes: ServiceRoute[] = [
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
  @Validate({
    query: ['alias', 'id']
  })
  @HasPermission(PlayersAPIPolicy, 'identify')
  @Resource(PlayerResource, 'player')
  async identify(req: ServiceRequest): Promise<ServiceResponse> {
    const { alias, id } = req.query
    const em: EntityManager = req.ctx.em

    const key: APIKey = await this.getAPIKey(req.ctx)

    const player = await em.getRepository(Player).findOne({
      aliases: {
        [alias]: id
      },
      game: key.game
    })

    if (!player) req.ctx.throw(404, 'Player not found')

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
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    const key: APIKey = await this.getAPIKey(req.ctx)
    req.query = {
      gameId: key.game.id.toString()
    }

    return await this.getService<PlayersService>(req).get(req)
  }

  @HasPermission(PlayersAPIPolicy, 'post')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const key: APIKey = await this.getAPIKey(req.ctx)
    req.body = {
      gameId: key.game.id
    }

    return await this.getService<PlayersService>(req).post(req)
  }
}
