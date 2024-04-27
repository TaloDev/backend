import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Routes, Validate } from 'koa-clay'
import APIKey, { APIKeyScope } from '../entities/api-key'
import jwt from 'jsonwebtoken'
import APIKeyPolicy from '../policies/api-key.policy'
import groupBy from 'lodash.groupby'
import { promisify } from 'util'
import createGameActivity from '../lib/logging/createGameActivity'
import { GameActivityType } from '../entities/game-activity'

export async function createToken(em: EntityManager, apiKey: APIKey): Promise<string> {
  await em.populate(apiKey, ['game.apiSecret'])

  const payload = { sub: apiKey.id, api: true }
  const token = await promisify(jwt.sign)(payload, apiKey.game.apiSecret.getPlainSecret())
  return token
}

@Routes([
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
])
export default class APIKeyService extends Service {
  @Validate({ body: ['scopes'] })
  @HasPermission(APIKeyPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { scopes } = req.body
    const em: EntityManager = req.ctx.em

    const apiKey = new APIKey(req.ctx.state.game, req.ctx.state.user)
    apiKey.scopes = scopes

    await createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.API_KEY_CREATED,
      extra: {
        keyId: apiKey.id,
        display: {
          'Scopes': scopes.join(', ')
        }
      }
    })

    await em.persistAndFlush(apiKey)

    const token = await createToken(em, apiKey)

    return {
      status: 200,
      body: {
        token,
        apiKey
      }
    }
  }

  @HasPermission(APIKeyPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const apiKeys = await em.getRepository(APIKey).find({ game: req.ctx.state.game, revokedAt: null }, { populate: ['createdByUser'] })

    return {
      status: 200,
      body: {
        apiKeys
      }
    }
  }

  @HasPermission(APIKeyPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const apiKey = req.ctx.state.apiKey as APIKey // set in the policy
    apiKey.revokedAt = new Date()

    const token = await createToken(em, apiKey)

    await createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.API_KEY_REVOKED,
      extra: {
        keyId: apiKey.id,
        display: {
          'Key ending in': token.substring(token.length - 5, token.length)
        }
      }
    })

    await em.flush()

    return {
      status: 204
    }
  }

  async scopes(): Promise<Response> {
    const scopes = Object.keys(APIKeyScope)
      .filter((key) => APIKeyScope[key] !== APIKeyScope.FULL_ACCESS)
      .map((key) => APIKeyScope[key])

    return {
      status: 200,
      body: {
        scopes: groupBy(scopes, (scope) => scope.split(':')[1])
      }
    }
  }
}
