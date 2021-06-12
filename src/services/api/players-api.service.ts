import { EntityManager } from '@mikro-orm/core'
import { ServiceRequest, ServiceResponse, ServiceRoute, Validate, HasPermission } from 'koa-rest-services'
import APIKey from '../../entities/api-key'
import PlayerAlias from '../../entities/player-alias'
import PlayersAPIPolicy from '../../policies/api/players-api.policy'
import PlayersService from '../players.service'
import APIService from './api-service'

export default class PlayersAPIService extends APIService<PlayersService> {
  routes: ServiceRoute[] = [
    {
      method: 'GET',
      handler: 'index'
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

  constructor() {
    super('players')
  }

  @Validate({
    query: ['service', 'identifier']
  })
  @HasPermission(PlayersAPIPolicy, 'identify')
  async identify(req: ServiceRequest): Promise<ServiceResponse> {
    const { service, identifier } = req.query
    const em: EntityManager = req.ctx.em

    const key: APIKey = await this.getAPIKey(req.ctx)

    const alias = await em.getRepository(PlayerAlias).findOne({
      service,
      identifier,
      player: {
        game: key.game
      }
    }, ['player'])

    if (!alias) req.ctx.throw(404, 'Player not found')

    alias.player.lastSeenAt = new Date()
    await em.flush()

    return {
      status: 200,
      body: {
        alias
      }
    }
  }

  @HasPermission(PlayersAPIPolicy, 'index')
  async index(req: ServiceRequest): Promise<ServiceResponse> {
    const key: APIKey = await this.getAPIKey(req.ctx)
    req.query = {
      gameId: key.game.id.toString()
    }

    return await this.forwardRequest('index', req)
  }

  @HasPermission(PlayersAPIPolicy, 'post')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const key: APIKey = await this.getAPIKey(req.ctx)
    req.body = {
      ...req.body,
      gameId: key.game.id
    }

    return await this.forwardRequest('post', req)
  }

  @HasPermission(PlayersAPIPolicy, 'patch')
  async patch(req: ServiceRequest): Promise<ServiceResponse> {
    return await this.forwardRequest('patch', req)
  }
}
