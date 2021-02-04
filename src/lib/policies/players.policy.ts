import Policy from './policy'
import { ServiceRequest } from 'koa-rest-services'

export default class PlayersPolicy extends Policy {
  async get(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query

    if (this.isAPICall()) return true
    return this.canAccessGame(Number(gameId))
  }

  async post(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.body

    if (this.isAPICall()) return true
    return this.canAccessGame(Number(gameId))
  }
}
