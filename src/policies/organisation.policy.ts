import Policy from './policy.js'
import { PolicyResponse } from 'koa-clay'
import { UserType } from '../entities/user.js'
import UserTypeGate from './user-type-gate.js'

export default class OrganisationPolicy extends Policy {
  @UserTypeGate([UserType.ADMIN], 'view organisation info')
  async current(): Promise<PolicyResponse> {
    return true
  }
}
