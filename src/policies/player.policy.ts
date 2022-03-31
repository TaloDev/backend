import Policy from './policy'
import { PolicyDenial, Request, PolicyResponse } from 'koa-clay'
import Player from '../entities/player'
import { UserType } from '../entities/user'

export default class PlayerPolicy extends Policy {
  async getPlayer(id: string, relations?: string[]): Promise<Player> {
    const player = await this.em.getRepository(Player).findOne(id, { populate: relations as never[] })
    this.ctx.state.player = player

    return player
  }

  async index(req: Request): Promise<boolean> {
    const { gameId } = req.query

    if (this.isAPICall()) return true
    return await this.canAccessGame(Number(gameId))
  }

  async post(req: Request): Promise<boolean> {
    const { gameId } = req.body

    if (this.isAPICall()) return true
    return await this.canAccessGame(Number(gameId))
  }

  async patch(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    if (!this.isAPICall()) {
      const user = await this.getUser()
      if (user.type === UserType.DEMO) {
        return new PolicyDenial({ message: 'Demo accounts cannot update player properties' })
      }
    }

    const player = await this.getPlayer(id)
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    if (this.isAPICall()) return true
    return await this.canAccessGame(player.game.id)
  }

  async getEvents(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const player = await this.getPlayer(id, ['aliases'])
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.canAccessGame(player.game.id)
  }

  async getStats(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const player = await this.getPlayer(id)
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.canAccessGame(player.game.id)
  }
}
