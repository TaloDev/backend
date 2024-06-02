import Policy from './policy.js'
import { PolicyResponse } from 'koa-clay'
import { UserType } from '../entities/user.js'
import UserTypeGate from './user-type-gate.js'
import EmailConfirmedGate from './email-confirmed-gate.js'

export default class InvitePolicy extends Policy {
  @UserTypeGate([UserType.ADMIN], 'view invites')
  async index(): Promise<PolicyResponse> {
    return true
  }

  @UserTypeGate([UserType.ADMIN], 'create invites')
  @EmailConfirmedGate('create invites')
  async post(): Promise<PolicyResponse> {
    return true
  }
}
