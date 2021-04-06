import Policy from './policy'
import { ServiceRequest } from 'koa-rest-services'

export default class HeadlinesPolicy extends Policy {
  async get(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query
    return await this.canAccessGame(Number(gameId))
  }
}
