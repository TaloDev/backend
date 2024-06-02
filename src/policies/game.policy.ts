import Policy from './policy.js'
import { PolicyResponse, Request } from 'koa-clay'
import { UserType } from '../entities/user.js'
import UserTypeGate from './user-type-gate.js'

export default class GamePolicy extends Policy {
  @UserTypeGate([UserType.ADMIN, UserType.DEV], 'create games')
  async post(): Promise<PolicyResponse> {
    return true
  }

  @UserTypeGate([UserType.ADMIN], 'update games')
  async patch(req: Request): Promise<PolicyResponse> {
    const { id } = req.params
    return this.canAccessGame(Number(id))
  }
}
