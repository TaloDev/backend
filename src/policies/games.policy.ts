import Policy from './policy'
import { ServicePolicyDenial, ServicePolicyResponse } from 'koa-rest-services'
import { UserType } from '../entities/user'

export default class GamesPolicy extends Policy {
  async post(): Promise<ServicePolicyResponse> {
    const user = await this.getUser()
    if (user.type === UserType.DEMO) return new ServicePolicyDenial({ message: 'Demo accounts cannot create games' })

    return true
  }
}
