import Policy from '../policy'
import { ServicePolicyDenial, ServicePolicyResponse, ServiceRequest } from 'koa-rest-services'
import Leaderboard from '../../entities/leaderboard'
import PlayerAlias from '../../entities/player-alias'

export default class LeaderboardsAPIPolicy extends Policy {
  async getLeaderboard(req: ServiceRequest): Promise<Leaderboard | null> {
    const { internalName } = req.params

    const key = await this.getAPIKey()
    const leaderboard = await this.em.getRepository(Leaderboard).findOne({
      internalName,
      game: key.game
    })

    this.ctx.state.leaderboard = leaderboard

    return leaderboard
  }

  async get(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const scopeCheck = await this.hasScope('read:leaderboards')
    if (scopeCheck !== true) return scopeCheck

    const leaderboard = await this.getLeaderboard(req)
    if (!leaderboard) return new ServicePolicyDenial({ message: 'Leaderboard not found' }, 404)

    return true
  }

  async post(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const scopeCheck = await this.hasScope('write:leaderboards')
    if (scopeCheck !== true) return scopeCheck

    const leaderboard = await this.getLeaderboard(req)
    if (!leaderboard) return new ServicePolicyDenial({ message: 'Leaderboard not found' }, 404)

    const { aliasId } = req.body

    const playerAlias = await this.em.getRepository(PlayerAlias).findOne({
      id: aliasId,
      player: {
        game: this.ctx.state.key.game
      }
    })

    if (!playerAlias) return new ServicePolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.playerAlias = playerAlias

    return true
  }
}
