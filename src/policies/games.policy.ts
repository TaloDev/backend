import Policy from './policy'
import { PolicyDenial, PolicyResponse } from 'koa-clay'
import { UserType } from '../entities/user'

export default class GamePolicy extends Policy {
  async post(): Promise<PolicyResponse> {
    const user = await this.getUser()
    if (user.type === UserType.DEMO) return new PolicyDenial({ message: 'Demo accounts cannot create games' })

    return true
  }
}
