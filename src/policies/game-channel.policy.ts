import Policy from './policy'
import { PolicyResponse, Request } from 'koa-clay'

export default class GameChannelPolicy extends Policy {
  async index(req: Request): Promise<PolicyResponse> {
    if (this.isAPICall()) return true

    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }
}
