import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Resource, ServiceRequest, ServiceResponse, ServiceRoute, Validate } from 'koa-rest-services'
import APIKey, { APIKeyScope } from '../entities/api-key'
import jwt from 'jsonwebtoken'
import APIKeysPolicy from '../policies/api-keys.policy'
import APIKeyResource from '../resources/api-key.resource'
import groupBy from 'lodash.groupby'
import User from '../entities/user'
import { promisify } from 'util'

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

export async function createToken(apiKey: APIKey, payloadParams?: { [key: string]: any }): Promise<string> {
  const payload = { sub: apiKey.id, api: true, ...payloadParams }
  const token = await promisify(jwt.sign)(payload, process.env.JWT_SECRET)
  return token
}

export default class APIKeysService {
  @Validate({
    body: ['gameId']
  })
  @HasPermission(APIKeysPolicy, 'post')
  @Resource(APIKeyResource, 'apiKey')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { scopes } = req.body
    const em: EntityManager = req.ctx.em

    const createdByUser = await em.getRepository(User).findOne(req.ctx.state.user.sub)
    const apiKey = new APIKey(req.ctx.state.game, createdByUser)
    apiKey.scopes = scopes ?? []
    await em.getRepository(APIKey).persistAndFlush(apiKey)

    const token = await createToken(apiKey)

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
    const em: EntityManager = req.ctx.em

    const apiKey = req.ctx.state.apiKey // set in the policy
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
