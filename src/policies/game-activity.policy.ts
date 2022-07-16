import Policy from './policy'
import { PolicyResponse, Request } from 'koa-clay'
import { UserType } from '../entities/user'
import UserTypeGate from './user-type-gate'

export default class GameActivityPolicy extends Policy {
  @UserTypeGate([UserType.ADMIN, UserType.DEMO], 'view game activities')
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }
}
