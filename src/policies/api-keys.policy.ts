import Policy from './policy'
import { ServiceRequest } from 'koa-rest-services'
import APIKey from '../entities/api-key'
import { UserType } from '../entities/user'

export default class APIKeysPolicy extends Policy {
  async post(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.body

    const user = await this.getUser()

    if (user.type !== UserType.ADMIN) req.ctx.throw(403, 'You do not have permissions to manage API keys')
    if (!user.emailConfirmed) req.ctx.throw(403, 'You need to confirm your email address to do this')

    const canAccessGame = await this.canAccessGame(gameId)
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
