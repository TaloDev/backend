import Policy from './policy'
import { Request } from 'koa-clay'

export default class EventPolicy extends Policy {
  index(req: Request): Promise<boolean> {
    const { gameId } = req.params
    return this.canAccessGame(Number(gameId))
  }

  breakdown(req: Request): Promise<boolean> {
    const { gameId } = req.params
    return this.canAccessGame(Number(gameId))
  }
}
