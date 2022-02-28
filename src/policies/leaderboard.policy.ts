import Policy from './policy'
import { PolicyDenial, Request, PolicyResponse } from 'koa-clay'
import { UserType } from '../entities/user'
import Leaderboard from '../entities/leaderboard'

export default class LeaderboardPolicy extends Policy {
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.query
    return await this.canAccessGame(Number(gameId))
  }

  async get(req: Request): Promise<PolicyResponse> {
    const { internalName } = req.params
    const { gameId } = req.query

    // get and entries endpoints share this policy
    const relations = req.path.endsWith('entries') ? ['entries'] : []

    const leaderboard = await this.em.getRepository(Leaderboard).findOne({
      internalName,
      game: Number(gameId)
    }, {
      populate: relations as never[]
    })

    if (!leaderboard) return new PolicyDenial({ message: 'Leaderboard not found' }, 404)

    this.ctx.state.leaderboard = leaderboard

    if (this.isAPICall()) return true
    return await this.canAccessGame(Number(gameId))
  }

  async post(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.body

    const user = await this.getUser()
    if (user.type === UserType.DEMO) return new PolicyDenial({ message: 'Demo accounts cannot create leaderboards' })

    return await this.canAccessGame(gameId)
  }

  async updateEntry(req: Request): Promise<PolicyResponse> {
    return await this.get({
      ...req,
      query: {
        gameId: req.body.gameId
      }
    })
  }

  async updateLeaderboard(req: Request): Promise<PolicyResponse> {
    return await this.get({
      ...req,
      query: {
        gameId: req.body.gameId
      }
    })
  }

  async delete(req: Request): Promise<PolicyResponse> {
    const user = await this.getUser()
    if (user.type !== UserType.ADMIN) return new PolicyDenial({ message: 'You do not have permissions to delete leaderboards' })

    return await this.get({
      ...req,
      query: {
        gameId: req.body.gameId
      }
    })
  }
}
