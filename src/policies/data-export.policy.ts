import Policy from './policy'
import { PolicyDenial, Request, PolicyResponse } from 'koa-clay'
import { UserType } from '../entities/user'
import UserTypeGate from './user-type-gate'

export default class DataExportPolicy extends Policy {
  @UserTypeGate([UserType.ADMIN], 'view data exports')
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.query
    return await this.canAccessGame(Number(gameId))
  }

  @UserTypeGate([UserType.ADMIN], 'create data exports')
  async post(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.body

    const user = await this.getUser()
    if (!user.emailConfirmed) return new PolicyDenial({ message: 'You need to confirm your email address to create data exports' })

    return await this.canAccessGame(gameId)
  }
}
