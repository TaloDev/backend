import Policy from './policy'
import { PolicyResponse, PolicyDenial } from 'koa-clay'
import { UserType } from '../entities/user'

export default class InvitePolicy extends Policy {
  async index(): Promise<PolicyResponse> {
    const user = await this.getUser()
    if (user.type !== UserType.ADMIN) return new PolicyDenial({ message: 'You do not have permissions to view invites' })

    return true
  }

  async post(): Promise<PolicyResponse> {
    const user = await this.getUser()
    if (user.type !== UserType.ADMIN) return new PolicyDenial({ message: 'You do not have permissions to create invites' })

    return true
  }
}
