import Policy from './policy'
import { PolicyDenial, Request, PolicyResponse } from 'koa-clay'
import APIKey from '../entities/api-key'
import { UserType } from '../entities/user'

export default class APIKeyPolicy extends Policy {
  async post(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.body

    const user = await this.getUser()

    if (user.type !== UserType.ADMIN) return new PolicyDenial({ message: 'You do not have permissions to manage API keys' })
    if (!user.emailConfirmed) return new PolicyDenial({ message: 'You need to confirm your email address to do this' })

    const canAccessGame = await this.canAccessGame(gameId)
    return canAccessGame
  }

  async index(req: Request): Promise<boolean> {
    const { gameId } = req.query
    return await this.canAccessGame(Number(gameId))
  }

  async delete(req: Request): Promise<PolicyResponse> {
    const { id } = req.params
    const apiKey = await this.em.getRepository(APIKey).findOne(Number(id))
    if (!apiKey) return new PolicyDenial({ message: 'API key not found' }, 404)
    this.ctx.state.apiKey = apiKey

    return await this.canAccessGame(apiKey.game.id)
  }
}
