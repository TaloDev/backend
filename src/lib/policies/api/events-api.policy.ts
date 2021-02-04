import Policy from '../policy'
import { ServiceRequest } from 'koa-rest-services'
import Player from '../../../entities/player'

export default class EventsAPIPolicy extends Policy {
  async get(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query
    return this.canAccessGame(Number(gameId))
  }

  async post(req: ServiceRequest): Promise<boolean> {
    const { playerId } = req.body
    const player = await this.em.getRepository(Player).findOne(playerId)
    if (!player) return false

    return this.canAccessGame(Number(player.game.id))
  }
}
