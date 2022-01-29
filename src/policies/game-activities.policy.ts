import Policy from './policy'
import { ServicePolicyDenial, ServicePolicyResponse, ServiceRequest } from 'koa-rest-services'
import { UserType } from '../entities/user'

export default class GameActivitysPolicy extends Policy {
  async index(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const { gameId } = req.query

    const user = await this.getUser()
    if (user.type === UserType.DEV) {
      return new ServicePolicyDenial({ message: 'You do not have permissions to view game activities' })
    }

    return await this.canAccessGame(Number(gameId))
  }
}
