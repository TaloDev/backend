import Policy from './policy'
import { PolicyResponse, Request } from 'koa-clay'
import { UserType } from '../entities/user'
import UserTypeGate from './user-type-gate'

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
