import Policy from './policy'
import { ServiceRequest } from 'koa-rest-services'
import Player from '../../entities/player'

export default class PlayersPolicy extends Policy {
  async get(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query

    if (this.isAPICall()) return true
    return await this.canAccessGame(Number(gameId))
  }

  async post(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.body

    if (this.isAPICall()) return true
    return await this.canAccessGame(Number(gameId))
  }

  async patch(req: ServiceRequest): Promise<boolean> {
    const { id } = req.params

    const player = await this.em.getRepository(Player).findOne(id)
    if (!player) this.ctx.throw(404, 'Player not found')
    this.ctx.state.player = player

    if (this.isAPICall()) return true
    return await this.canAccessGame(player.game.id)
  }
}
