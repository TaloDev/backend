import Policy from './policy'
import { Context } from 'koa'
import { ServiceRequest } from 'koa-rest-services'

export default class EventsPolicy extends Policy {
  constructor(ctx: Context) {
    super(ctx)
  }

  async get(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query

    if (this.isAPICall()) return true
    return this.canAccessGame(Number(gameId))
  }
}
