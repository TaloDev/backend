import Policy from './policy'
import { ServicePolicyDenial, ServiceRequest } from 'koa-rest-services'
import { UserType } from '../entities/user'

export default class GamesPolicy extends Policy {
  async post(req: ServiceRequest): Promise<boolean | ServicePolicyDenial> {
    const user = await this.getUser()
    if (user.type === UserType.DEMO) return new ServicePolicyDenial({ message: 'Demo accounts cannot create games' })

    return true
  }
}
