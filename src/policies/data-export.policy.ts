import Policy from './policy'
import { PolicyDenial, Request, PolicyResponse } from 'koa-clay'
import { UserType } from '../entities/user'

export default class DataExportPolicy extends Policy {
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.query

    const user = await this.getUser()
    if (user.type !== UserType.ADMIN) return new PolicyDenial({ message: 'You do not have permissions to view data exports' })

    return await this.canAccessGame(Number(gameId))
  }

  async post(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.body

    const user = await this.getUser()
    if (user.type !== UserType.ADMIN) return new PolicyDenial({ message: 'You do not have permissions to create data exports' })
    if (!user.emailConfirmed) return new PolicyDenial({ message: 'You need to confirm your email address to create data exports' })

    return await this.canAccessGame(gameId)
  }
}
