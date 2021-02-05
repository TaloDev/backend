import Policy from '../policy'
import { ServiceRequest } from 'koa-rest-services'

export default class PlayersAPIPolicy extends Policy {
  async get(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query
    return this.hasScope('read:players') && this.canAccessGame(Number(gameId))
  }

  async post(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.body
    return this.hasScope('write:players') && this.canAccessGame(Number(gameId))
  }
}
