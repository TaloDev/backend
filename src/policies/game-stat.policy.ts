import Policy from './policy'
import { PolicyResponse, PolicyDenial, Request } from 'koa-clay'
import { UserType } from '../entities/user'
import GameStat from '../entities/game-stat'
import UserTypeGate from './user-type-gate'

export default class GameStatPolicy extends Policy {
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.query
    return await this.canAccessGame(Number(gameId))
  }

  @UserTypeGate([UserType.ADMIN, UserType.DEV], 'create stats')
  async post(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.body
    return await this.canAccessGame(gameId)
  }

  async getStat(id: number): Promise<GameStat> {
    const stat = await this.em.getRepository(GameStat).findOne(Number(id), { populate: ['game'] })
    this.ctx.state.stat = stat
    return stat
  }

  async patch(req: Request): Promise<PolicyResponse> {
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
