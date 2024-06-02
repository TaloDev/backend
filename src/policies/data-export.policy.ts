import Policy from './policy.js'
import { Request, PolicyResponse } from 'koa-clay'
import { UserType } from '../entities/user.js'
import UserTypeGate from './user-type-gate.js'
import EmailConfirmedGate from './email-confirmed-gate.js'

export default class DataExportPolicy extends Policy {
  @UserTypeGate([UserType.ADMIN], 'view data exports')
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  @UserTypeGate([UserType.ADMIN], 'create data exports')
  @EmailConfirmedGate('create data exports')
  async post(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }
}
