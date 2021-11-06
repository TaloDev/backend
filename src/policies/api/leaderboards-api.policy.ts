import Policy from '../policy'
import { ServicePolicyDenial, ServicePolicyResponse, ServiceRequest } from 'koa-rest-services'
import Leaderboard from '../../entities/leaderboard'
import PlayerAlias from '../../entities/player-alias'

export default class LeaderboardsAPIPolicy extends Policy {
  async getEntities(req: ServiceRequest, reqKey: 'query' | 'body'): Promise<[Leaderboard?, PlayerAlias?]> {
    const { internalName, aliasId } = req[reqKey]

    const key = await this.getAPIKey()

    const leaderboard = await this.em.getRepository(Leaderboard).findOne({
      internalName,
      game: key.game
    })

    const playerAlias = await this.em.getRepository(PlayerAlias).findOne({
      id: Number(aliasId),
      player: {
        game: key.game
      }
    })

    return [leaderboard, playerAlias]
  }

  async index(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const [leaderboard, playerAlias] = await this.getEntities(req, 'query')

    if (!leaderboard) return new ServicePolicyDenial({ message: 'Leaderboard not found' }, 404)
    if (!playerAlias) return new ServicePolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.leaderboard = leaderboard
    this.ctx.state.playerAlias = playerAlias

    return await this.hasScope('read:leaderboards')
  }

  async post(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const [leaderboard, playerAlias] = await this.getEntities(req, 'body')

    if (!leaderboard) return new ServicePolicyDenial({ message: 'Leaderboard not found' }, 404)
    if (!playerAlias) return new ServicePolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.leaderboard = leaderboard
    this.ctx.state.playerAlias = playerAlias

    return await this.hasScope('write:leaderboards')
  }
}
