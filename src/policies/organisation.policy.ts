import Policy from './policy'
import { PolicyResponse, PolicyDenial } from 'koa-clay'
import { UserType } from '../entities/user'

export default class OrganisationPolicy extends Policy {
  async get(): Promise<PolicyResponse> {
    const user = await this.getUser()
    if (user.type !== UserType.ADMIN) return new PolicyDenial({ message: 'You do not have permissions to view organisation info' })

    return true
  }
}
