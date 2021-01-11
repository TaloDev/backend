import { EntityManager } from '@mikro-orm/core'
import { ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import APIKey from '../entities/api-key'
import APIKeyScope from '../entities/api-key-scope'
import jwt from 'jsonwebtoken'
import Game from '../entities/game'

export default class APIKeysService {
  @Validate({
    body: {
      game: 'Missing body parameter: game'
    }
  })
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { scopes, game } = req.body
    const em: EntityManager = req.ctx.em

    const apiKey = new APIKey()
    apiKey.scopes = scopes?.map((scope) => new APIKeyScope(apiKey, scope))
    apiKey.game = await em.getRepository(Game).findOne(game)    
    await em.getRepository(APIKey).persistAndFlush(apiKey)

    const payload = {
      sub: apiKey.id,
      iat: Math.floor(apiKey.createdAt.getTime() / 1000)
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET)

    return {
      status: 200,
      body: {
        token
      }
    }
  }
}