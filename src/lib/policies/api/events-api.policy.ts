import Policy from '../policy'
import { ServiceRequest } from 'koa-rest-services'
import Player from '../../../entities/player'

export default class EventsAPIPolicy extends Policy {
  async get(req: ServiceRequest): Promise<boolean> {
    return this.hasScope('read:events')
  }

  async post(req: ServiceRequest): Promise<boolean> {
    const { playerId } = req.body
    const player = await this.em.getRepository(Player).findOne(playerId)
    if (!player) this.ctx.throw(404, 'Player not found')

    this.ctx.state.player = player

    return this.hasScope('write:events')
  }
}
