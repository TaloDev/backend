import Policy from './policy'
import { PolicyDenial, Request, PolicyResponse } from 'koa-clay'
import APIKey from '../entities/api-key'
import { UserType } from '../entities/user'
import UserTypeGate from './user-type-gate'
import EmailConfirmedGate from './email-confirmed-gate'

export default class APIKeyPolicy extends Policy {
  @UserTypeGate([UserType.ADMIN], 'create API keys')
  @EmailConfirmedGate('create API keys')
  async post(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  async index(req: Request): Promise<boolean> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  @UserTypeGate([UserType.ADMIN], 'revoke API keys')
  async delete(req: Request): Promise<PolicyResponse> {
    const { id } = req.params
    const apiKey = await this.em.getRepository(APIKey).findOne(Number(id))
    if (!apiKey) return new PolicyDenial({ message: 'API key not found' }, 404)
    this.ctx.state.apiKey = apiKey

    return await this.canAccessGame(apiKey.game.id)
  }
}
