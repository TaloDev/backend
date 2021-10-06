import Policy from './policy'
import { ServicePolicyDenial, ServiceRequest } from 'koa-rest-services'
import { UserType } from '../entities/user'

export default class DataExportsPolicy extends Policy {
  async index(req: ServiceRequest): Promise<boolean | ServicePolicyDenial> {
    const { gameId } = req.query

    const user = await this.getUser()
    if (user.type !== UserType.ADMIN) return new ServicePolicyDenial({ message: 'You do not have permissions to view data exports' })

    return await this.canAccessGame(Number(gameId))
  }

  async post(req: ServiceRequest): Promise<boolean | ServicePolicyDenial> {
    const { gameId } = req.body

    const user = await this.getUser()
    if (user.type !== UserType.ADMIN) return new ServicePolicyDenial({ message: 'You do not have permissions to create data exports' })
    if (!user.emailConfirmed) return new ServicePolicyDenial({ message: 'You need to confirm your email address to create data exports' })

    req.ctx.state.user = user

    return await this.canAccessGame(gameId)
  }
}
