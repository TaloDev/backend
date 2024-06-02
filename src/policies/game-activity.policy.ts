import Policy from './policy.js'
import { PolicyResponse, Request } from 'koa-clay'
import { UserType } from '../entities/user.js'
import UserTypeGate from './user-type-gate.js'

export default class GameActivityPolicy extends Policy {
  @UserTypeGate([UserType.ADMIN, UserType.DEMO], 'view game activities')
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }
}
