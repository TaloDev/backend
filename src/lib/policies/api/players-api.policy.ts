import Policy from '../policy'
import { Context } from 'koa'
import { ServiceRequest } from 'koa-rest-services'

export default class PlayersAPIPolicy extends Policy {
  constructor(ctx: Context) {
    super(ctx)
  }

  async get(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query
    return this.canAccessGame(Number(gameId))
  }
}
