import Policy from './policy'
import { PolicyDenial, Request, PolicyResponse } from 'koa-clay'
import { UserType } from '../entities/user'
import Leaderboard from '../entities/leaderboard'

export default class LeaderboardPolicy extends Policy {
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.query
    return await this.canAccessGame(Number(gameId))
  }

  async canAccessLeaderboard(req: Request, relations: string[] = []): Promise<PolicyResponse> {
    const { id } = req.params

    const leaderboard = await this.em.getRepository(Leaderboard).findOne(Number(id), {
      populate: relations as never[]
    })

    if (!leaderboard) return new PolicyDenial({ message: 'Leaderboard not found' }, 404)

    this.ctx.state.leaderboard = leaderboard

    if (this.isAPICall()) return true
    return await this.canAccessGame(leaderboard.game.id)
  }

  async get(req: Request): Promise<PolicyResponse> {
    return await this.canAccessLeaderboard(req)
  }

  async post(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.body

    const user = await this.getUser()
    if (user.type === UserType.DEMO) return new PolicyDenial({ message: 'Demo accounts cannot create leaderboards' })

    return await this.canAccessGame(gameId)
  }

  async updateEntry(req: Request): Promise<PolicyResponse> {
    return await this.canAccessLeaderboard(req, ['entries'])
  }

  async updateLeaderboard(req: Request): Promise<PolicyResponse> {
    return await this.canAccessLeaderboard(req)
  }

  async delete(req: Request): Promise<PolicyResponse> {
    const user = await this.getUser()
    if (user.type !== UserType.ADMIN) return new PolicyDenial({ message: 'You do not have permissions to delete leaderboards' })

    return await this.canAccessLeaderboard(req)
  }
}
