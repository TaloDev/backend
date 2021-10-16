import Policy from './policy'
import { ServicePolicyDenial, ServiceRequest, ServicePolicyResponse } from 'koa-rest-services'
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

  async patch(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const { id } = req.params

    if (!this.isAPICall()) {
      const user = await this.getUser()
      if (user.type === UserType.DEMO) {
        return new ServicePolicyDenial({ message: 'Demo accounts cannot update player properties' })
      }
    }

    const player = await this.em.getRepository(Player).findOne(id)
    if (!player) return new ServicePolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.player = player

    if (this.isAPICall()) return true
    return await this.canAccessGame(player.game.id)
  }

  async getEvents(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const { id } = req.params

    const player = await this.em.getRepository(Player).findOne(id, ['aliases'])

    if (!player) return new ServicePolicyDenial({ message: 'Player not found' }, 404)
    this.ctx.state.player = player

    return await this.canAccessGame(player.game.id)
  }
}
