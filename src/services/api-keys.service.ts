import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Resource, ServiceRequest, ServiceResponse, ServiceRoute, Validate } from 'koa-rest-services'
import APIKey, { APIKeyScope } from '../entities/api-key'
import jwt from 'jsonwebtoken'
import Game from '../entities/game'
import APIKeysPolicy from '../lib/policies/api-keys.policy'
import APIKeyResource from '../resources/api-key.resource'
import groupBy from 'lodash.groupby'
import User from '../entities/user'

export const apiKeysRoutes: ServiceRoute[] = [
  {
    method: 'POST'
  },
  {
    method: 'GET'
  },
  {
    method: 'GET',
    path: '/scopes',
    handler: 'scopes'
  },
  {
    method: 'DELETE'
  }
]

export default class APIKeysService {
  @Validate({
    body: ['gameId']
  })
  @HasPermission(APIKeysPolicy, 'post')
  @Resource(APIKeyResource, 'apiKey')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { scopes, gameId } = req.body
    const em: EntityManager = req.ctx.em

    const apiKey = new APIKey()
    apiKey.scopes = scopes ?? []
    apiKey.game = await em.getRepository(Game).findOne(gameId)
    apiKey.createdByUser = await em.getRepository(User).findOne(req.ctx.state.user.sub)
    await em.getRepository(APIKey).persistAndFlush(apiKey)

    const payload = { sub: apiKey.id, scopes: apiKey.scopes }
    const token = jwt.sign(payload, process.env.JWT_SECRET)

    return {
      status: 200,
      body: {
        token,
        apiKey
      }
    }
  }

  @Validate({
    query: ['gameId']
  })
  @HasPermission(APIKeysPolicy, 'get')
  @Resource(APIKeyResource, 'apiKeys')
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId } = req.query
    const em: EntityManager = req.ctx.em
    const apiKeys = await em.getRepository(APIKey).find({ game: Number(gameId), revokedAt: null })

    return {
      status: 200,
      body: {
        apiKeys
      }
    }
  }

  @HasPermission(APIKeysPolicy, 'delete')
  @Resource(APIKeyResource, 'apiKey')
  async delete(req: ServiceRequest): Promise<ServiceResponse> {
    const { id } = req.params
    const em: EntityManager = req.ctx.em
    const apiKey = await em.getRepository(APIKey).findOne(id)
    apiKey.revokedAt = new Date()
    await em.flush()

    return {
      status: 204
    }
  }

  async scopes(req: ServiceRequest): Promise<ServiceResponse> {
    const scopes = Object.keys(APIKeyScope).map((key) => APIKeyScope[key])

    return {
      status: 200,
      body: {
        scopes: groupBy(scopes, (scope) => scope.split(':')[1])
      }
    }
  }
}
