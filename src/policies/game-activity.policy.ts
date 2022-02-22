import Policy from './policy'
import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { UserType } from '../entities/user'

export default class GameActivityPolicy extends Policy {
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.query

    const user = await this.getUser()
    if (user.type === UserType.DEV) {
      return new PolicyDenial({ message: 'You do not have permissions to view game activities' })
    }

    return await this.canAccessGame(Number(gameId))
  }
}
