import Policy from './policy'
import { Request } from 'koa-clay'

export default class EventPolicy extends Policy {
  async index(req: Request): Promise<boolean> {
    const { gameId } = req.query

    if (this.isAPICall()) return true
    return await this.canAccessGame(Number(gameId))
  }
}
