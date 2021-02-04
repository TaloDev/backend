import Policy from './policy'
import { ServiceRequest } from 'koa-rest-services'

export default class APIKeysPolicy extends Policy {
  async post(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.body

    return this.canAccessGame(Number(gameId))
  }
}
