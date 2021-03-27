import Policy from './policy'
import { ServiceRequest } from 'koa-rest-services'

export default class EventsPolicy extends Policy {
  async get(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query

    if (this.isAPICall()) return true
    return await this.canAccessGame(Number(gameId))
  }
}
