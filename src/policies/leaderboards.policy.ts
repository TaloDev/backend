import Policy from './policy'
import { ServicePolicyDenial, ServiceRequest, ServicePolicyResponse } from 'koa-rest-services'
import { UserType } from '../entities/user'
import Leaderboard from '../entities/leaderboard'

export default class LeaderboardsPolicy extends Policy {
  async index(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const { gameId } = req.query
    return await this.canAccessGame(Number(gameId))
  }

  async get(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const { internalName } = req.params
    const { gameId } = req.query

    // get and entries endpoints share this policy
    const relations = req.path.endsWith('entries') ? ['entries'] : []

    const leaderboard = await this.em.getRepository(Leaderboard).findOne({
      internalName,
      game: Number(gameId)
    }, relations)

    if (!leaderboard) return new ServicePolicyDenial({ message: 'Leaderboard not found' }, 404)

    this.ctx.state.leaderboard = leaderboard

    if (this.isAPICall()) return true
    return await this.canAccessGame(Number(gameId))
  }

  async post(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const { gameId } = req.body

    const user = await this.getUser()
    if (user.type === UserType.DEMO) return new ServicePolicyDenial({ message: 'Demo accounts cannot create leaderboards' })

    return await this.canAccessGame(gameId)
  }

  async updateEntry(req: ServiceRequest): Promise<ServicePolicyResponse> {
    return await this.get({
      ...req,
      query: {
        gameId: req.body.gameId
      }
    })
  }

  async updateLeaderboard(req: ServiceRequest): Promise<ServicePolicyResponse> {
    return await this.get({
      ...req,
      query: {
        gameId: req.body.gameId
      }
    })
  }

  async delete(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const user = await this.getUser()
    if (user.type !== UserType.ADMIN) return new ServicePolicyDenial({ message: 'You do not have permissions to delete leaderboards' })

    return await this.get({
      ...req,
      query: {
        gameId: req.body.gameId
      }
    })
  }
}
