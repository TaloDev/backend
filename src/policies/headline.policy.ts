import Policy from './policy.js'
import { Request } from 'koa-clay'

export default class HeadlinePolicy extends Policy {
  async index(req: Request): Promise<boolean> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }
}
