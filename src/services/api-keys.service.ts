import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Service, ServiceRequest, ServiceResponse, ServiceRoute, Validate } from 'koa-rest-services'
import APIKey, { APIKeyScope } from '../entities/api-key'
import jwt from 'jsonwebtoken'
import APIKeysPolicy from '../policies/api-keys.policy'
import groupBy from 'lodash.groupby'
import User from '../entities/user'
import { promisify } from 'util'

interface TokenPayload {
  sub: number
  api: boolean
  iat?: number
}

interface ExtraTokenPayloadParams {
  iat?: number
}

const getAPIKeyTokenPayload = (apiKey: APIKey, payloadParams?: ExtraTokenPayloadParams): TokenPayload => {
  return { sub: apiKey.id, api: true, ...payloadParams }
}

export async function createToken(apiKey: APIKey, payloadParams?: ExtraTokenPayloadParams): Promise<string> {
  const payload = getAPIKeyTokenPayload(apiKey, payloadParams)
  const token = await promisify(jwt.sign)(payload, process.env.JWT_SECRET)
  return token
}

export function createTokenSync(apiKey: APIKey, payloadParams?: ExtraTokenPayloadParams) {
  const payload = getAPIKeyTokenPayload(apiKey, payloadParams)
  return jwt.sign(payload, process.env.JWT_SECRET)
}

export default class APIKeysService implements Service {
  routes: ServiceRoute[] = [
    {
      method: 'POST'
    },
    {
      method: 'GET',
      handler: 'index'
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

  @Validate({
    body: ['gameId', 'scopes']
  })
  @HasPermission(APIKeysPolicy, 'post')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { scopes } = req.body
    const em: EntityManager = req.ctx.em

    const createdByUser = await em.getRepository(User).findOne(req.ctx.state.user.sub)
    const apiKey = new APIKey(req.ctx.state.game, createdByUser)
    apiKey.scopes = scopes
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
  @HasPermission(APIKeysPolicy, 'index')
  async index(req: ServiceRequest): Promise<ServiceResponse> {
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
