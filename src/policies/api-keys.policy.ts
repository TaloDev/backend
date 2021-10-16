import Policy from './policy'
import { ServicePolicyDenial, ServiceRequest, ServicePolicyResponse } from 'koa-rest-services'
import APIKey from '../entities/api-key'
import { UserType } from '../entities/user'

export default class APIKeysPolicy extends Policy {
  async post(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const { gameId } = req.body

    const user = await this.getUser()

    if (user.type !== UserType.ADMIN) return new ServicePolicyDenial({ message: 'You do not have permissions to manage API keys'})
    if (!user.emailConfirmed) return new ServicePolicyDenial({ message: 'You need to confirm your email address to do this' })

    const canAccessGame = await this.canAccessGame(gameId)
    return canAccessGame
  }

  async index(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query
    return await this.canAccessGame(Number(gameId))
  }

  async delete(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const { id } = req.params
    const apiKey = await this.em.getRepository(APIKey).findOne(Number(id))
    if (!apiKey) return new ServicePolicyDenial({ message: 'API key not found' }, 404)
    this.ctx.state.apiKey = apiKey

    return await this.canAccessGame(apiKey.game.id)
  }
}
