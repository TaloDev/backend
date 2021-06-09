import Policy from './policy'
import { ServicePolicyDenial, ServiceRequest } from 'koa-rest-services'
import Player from '../entities/player'
import { UserType } from '../entities/user'

export default class PlayersPolicy extends Policy {
  async index(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.query

    if (this.isAPICall()) return true
    return await this.canAccessGame(Number(gameId))
  }

  async post(req: ServiceRequest): Promise<boolean> {
    const { gameId } = req.body

    if (this.isAPICall()) return true
    return await this.canAccessGame(Number(gameId))
  }

  async patch(req: ServiceRequest): Promise<boolean | ServicePolicyDenial> {
    const { id } = req.params

    if (!this.isAPICall()) {
      const user = await this.getUser()
      if (user.type === UserType.DEMO) {
        return new ServicePolicyDenial({ message: 'Demo accounts cannot update player properties' })
      }
    }

    const player = await this.em.getRepository(Player).findOne(id)
    if (!player) this.ctx.throw(404, 'Player not found')

    this.ctx.state.player = player

    if (this.isAPICall()) return true
    return await this.canAccessGame(player.game.id)
  }

  async getEvents(req: ServiceRequest): Promise<boolean> {
    const { id } = req.params

    const player = await this.em.getRepository(Player).findOne(id, ['aliases'])

    if (!player) this.ctx.throw(404, 'Player not found')
    this.ctx.state.player = player

    return await this.canAccessGame(player.game.id)
  }
}
