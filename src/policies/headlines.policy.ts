import Policy from './policy'
import { Request } from 'koa-clay'

export default class HeadlinePolicy extends Policy {
  async index(req: Request): Promise<boolean> {
    const { gameId } = req.query
    return await this.canAccessGame(Number(gameId))
  }
}
