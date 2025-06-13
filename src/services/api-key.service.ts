import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Route, Validate } from 'koa-clay'
import APIKey, { APIKeyScope } from '../entities/api-key'
import APIKeyPolicy from '../policies/api-key.policy'
import { groupBy } from 'lodash'
import createGameActivity from '../lib/logging/createGameActivity'
import { GameActivityType } from '../entities/game-activity'
import Socket from '../socket'
import { sign } from '../lib/auth/jwt'
import { TraceService } from '../lib/routing/trace-service'

export async function createToken(em: EntityManager, apiKey: APIKey): Promise<string> {
  await em.populate(apiKey, ['game.apiSecret'])

  const payload = {
    sub: apiKey.id,
    api: true,
    iat: Math.floor(new Date(apiKey.createdAt).getTime() / 1000)
  }

  const token = await sign(payload, apiKey.game.apiSecret.getPlainSecret()!)
  return token
}

@TraceService()
export default class APIKeyService extends Service {
  @Route({
    method: 'POST'
  })
  @Validate({ body: ['scopes'] })
  @HasPermission(APIKeyPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { scopes } = req.body
    const em: EntityManager = req.ctx.em

    const apiKey = new APIKey(req.ctx.state.game, req.ctx.state.user)
    apiKey.scopes = scopes

    createGameActivity(em, {
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

  @Route({
    method: 'GET'
  })
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

  @Route({
    method: 'GET',
    path: '/scopes'
  })
  async scopes(): Promise<Response> {
    const scopes = Object.keys(APIKeyScope)
      .filter((key) => APIKeyScope[key as keyof typeof APIKeyScope] !== APIKeyScope.FULL_ACCESS)
      .map((key) => APIKeyScope[key as keyof typeof APIKeyScope])

    return {
      status: 200,
      body: {
        scopes: groupBy(scopes, (scope) => scope.split(':')[1])
      }
    }
  }

  @Route({
    method: 'DELETE',
    path: '/:id'
  })
  @HasPermission(APIKeyPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const apiKey = req.ctx.state.apiKey as APIKey
    apiKey.revokedAt = new Date()

    const token = await createToken(em, apiKey)

    createGameActivity(em, {
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

    const socket: Socket = req.ctx.wss
    const conns = socket.findConnections((conn) => conn.getAPIKeyId() === apiKey.id)
    await Promise.all(conns.map((conn) => socket.closeConnection(conn.getSocket())))

    await em.flush()

    return {
      status: 204
    }
  }

  @Route({
    method: 'PUT',
    path: '/:id'
  })
  @Validate({ body: ['scopes'] })
  @HasPermission(APIKeyPolicy, 'put')
  async put(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const apiKey = req.ctx.state.apiKey as APIKey
    await em.populate(apiKey, ['createdByUser'])

    apiKey.scopes = req.body.scopes

    const token = await createToken(em, apiKey)

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.API_KEY_UPDATED,
      extra: {
        keyId: apiKey.id,
        display: {
          'Key ending in': token.substring(token.length - 5, token.length),
          'Scopes': apiKey.scopes.join(', ')
        }
      }
    })

    await em.flush()

    return {
      status: 200,
      body: {
        apiKey
      }
    }
  }
}
