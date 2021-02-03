import { EntityManager } from '@mikro-orm/core'
import { ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import APIKey from '../entities/api-key'
import jwt from 'jsonwebtoken'
import Game from '../entities/game'

export default class APIKeysService {
  @Validate({
    body: ['gameId']
  })
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const { scopes, gameId } = req.body
    const em: EntityManager = req.ctx.em

    const apiKey = new APIKey()
    apiKey.scopes = scopes
    apiKey.game = await em.getRepository(Game).findOne(gameId)    
    await em.getRepository(APIKey).persistAndFlush(apiKey)

    const payload = { sub: apiKey.id, scopes: apiKey.scopes }
    const token = jwt.sign(payload, process.env.JWT_SECRET)

    return {
      status: 200,
      body: {
        token
      }
    }
  }
}
