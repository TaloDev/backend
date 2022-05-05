import Policy from './policy'
import { PolicyResponse } from 'koa-clay'
import { UserType } from '../entities/user'
import UserTypeGate from './user-type-gate'

export default class OrganisationPolicy extends Policy {
  @UserTypeGate([UserType.ADMIN], 'view organisation info')
  async current(): Promise<PolicyResponse> {
    return true
  }
}
