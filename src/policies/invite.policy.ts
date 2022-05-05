import Policy from './policy'
import { PolicyResponse } from 'koa-clay'
import { UserType } from '../entities/user'
import UserTypeGate from './user-type-gate'

export default class InvitePolicy extends Policy {
  @UserTypeGate([UserType.ADMIN], 'view invites')
  async index(): Promise<PolicyResponse> {
    return true
  }

  @UserTypeGate([UserType.ADMIN], 'create invites')
  async post(): Promise<PolicyResponse> {
    return true
  }
}
