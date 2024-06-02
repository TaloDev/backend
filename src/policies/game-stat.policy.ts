import Policy from './policy.js'
import { PolicyResponse, PolicyDenial, Request } from 'koa-clay'
import { UserType } from '../entities/user.js'
import GameStat from '../entities/game-stat.js'
import UserTypeGate from './user-type-gate.js'

export default class GameStatPolicy extends Policy {
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  @UserTypeGate([UserType.ADMIN, UserType.DEV], 'create stats')
  async post(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  async getStat(id: number): Promise<GameStat> {
    this.ctx.state.stat = await this.em.getRepository(GameStat).findOne(Number(id), { populate: ['game'] })
    return this.ctx.state.stat
  }

  async put(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const stat = await this.getStat(Number(id))
    if (!stat) return new PolicyDenial({ message: 'Stat not found' }, 404)

    return await this.canAccessGame(stat.game.id)
  }

  @UserTypeGate([UserType.ADMIN], 'delete stats')
  async delete(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const stat = await this.getStat(Number(id))
    if (!stat) return new PolicyDenial({ message: 'Stat not found' }, 404)

    return await this.canAccessGame(stat.game.id)
  }
}
