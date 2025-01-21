import Policy from './policy'
import { PolicyDenial, Request, PolicyResponse } from 'koa-clay'
import { UserType } from '../entities/user'
import Leaderboard from '../entities/leaderboard'
import UserTypeGate from './user-type-gate'

export default class LeaderboardPolicy extends Policy {
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  async canAccessLeaderboard(req: Request, relations: string[] = []): Promise<PolicyResponse> {
    const { id } = req.params

    const leaderboard = await this.em.getRepository(Leaderboard).findOne(Number(id), { populate: relations as never[] })
    if (!leaderboard) return new PolicyDenial({ message: 'Leaderboard not found' }, 404)

    this.ctx.state.leaderboard = leaderboard

    return await this.canAccessGame(leaderboard.game.id)
  }

  async get(req: Request): Promise<PolicyResponse> {
    if (this.isAPICall()) return true
    return await this.canAccessLeaderboard(req)
  }

  @UserTypeGate([UserType.ADMIN, UserType.DEV], 'create leaderboards')
  async post(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  @UserTypeGate([UserType.ADMIN], 'update leaderboard entries')
  async updateEntry(req: Request): Promise<PolicyResponse> {
    return await this.canAccessLeaderboard(req, ['entries'])
  }

  async updateLeaderboard(req: Request): Promise<PolicyResponse> {
    return await this.canAccessLeaderboard(req)
  }

  @UserTypeGate([UserType.ADMIN], 'delete leaderboards')
  async delete(req: Request): Promise<PolicyResponse> {
    return await this.canAccessLeaderboard(req)
  }

  async search(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }
}
