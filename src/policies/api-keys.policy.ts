import Policy from './policy'
import { ServiceRequest } from 'koa-rest-services'
import APIKey from '../entities/api-key'

export default class APIKeysPolicy extends Policy {
  async post(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.body
    const canAccessGame = await this.canAccessGame(gameId)
    const user = await this.getUser()
    if (!user.emailConfirmed) req.ctx.throw(403, 'You need to confirm your email address to do this')
    return canAccessGame
  }

  async get(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query
    return await this.canAccessGame(Number(gameId))
  }

  async delete(req: ServiceRequest): Promise<boolean> {
    const { id } = req.params
    const apiKey = await this.em.getRepository(APIKey).findOne(id)
    if (!apiKey) req.ctx.throw(404, 'API key not found')
    this.ctx.state.apiKey = apiKey

    return await this.canAccessGame(apiKey.game.id)
  }
}
