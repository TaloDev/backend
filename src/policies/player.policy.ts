import Policy from './policy'
import { PolicyDenial, Request, PolicyResponse } from 'koa-clay'
import Player from '../entities/player'
import { UserType } from '../entities/user'
import UserTypeGate from './user-type-gate'

export default class PlayerPolicy extends Policy {
  async getPlayer(id: string): Promise<Player | null> {
    const player = await this.em.repo(Player).findOne(id, {
      populate: ['aliases'],
      strategy: 'joined' // balanced isn't loading props for some reason
    })
    this.ctx.state.player = player

    return player
  }

  async index(req: Request): Promise<boolean> {
    if (this.isAPICall()) return true

    const { gameId } = req.params
    return this.canAccessGame(Number(gameId))
  }

  async get(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const player = await this.getPlayer(id)
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.canAccessGame(player.game.id)
  }

  async post(req: Request): Promise<boolean> {
    if (this.isAPICall()) return true

    const { gameId } = req.params
    return this.canAccessGame(Number(gameId))
  }

  @UserTypeGate([UserType.ADMIN, UserType.DEV], 'update player properties')
  async patch(req: Request): Promise<PolicyResponse> {
    if (this.isAPICall()) return true

    const { id } = req.params

    const player = await this.getPlayer(id)
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.canAccessGame(player.game.id)
  }

  @UserTypeGate([UserType.ADMIN], 'delete players')
  async delete(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const player = await this.getPlayer(id)
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.canAccessGame(player.game.id)
  }

  async getEvents(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const player = await this.getPlayer(id)
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.canAccessGame(player.game.id)
  }

  async getStats(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const player = await this.getPlayer(id)
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.canAccessGame(player.game.id)
  }

  async getSaves(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const player = await this.getPlayer(id)
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.canAccessGame(player.game.id)
  }

  @UserTypeGate([UserType.ADMIN], 'view player auth activities')
  async getAuthActivities(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const player = await this.getPlayer(id)
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.canAccessGame(player.game.id)
  }
}
