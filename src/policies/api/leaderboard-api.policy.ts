import Policy from '../policy'
import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import Leaderboard from '../../entities/leaderboard'
import PlayerAlias from '../../entities/player-alias'
import { APIKeyScope } from '../../entities/api-key'

export default class LeaderboardAPIPolicy extends Policy {
  async getLeaderboard(req: Request): Promise<Leaderboard | null> {
    const { internalName } = req.params

    const key = this.getAPIKey()
    return await this.em.getRepository(Leaderboard).findOne({
      internalName,
      game: key.game
    })
  }

  async get(req: Request): Promise<PolicyResponse> {
    this.ctx.state.leaderboard = await this.getLeaderboard(req)
    if (!this.ctx.state.leaderboard) return new PolicyDenial({ message: 'Leaderboard not found' }, 404)

    return await this.hasScope(APIKeyScope.READ_LEADERBOARDS)
  }

  async post(req: Request): Promise<PolicyResponse> {
    this.ctx.state.leaderboard = await this.getLeaderboard(req)
    if (!this.ctx.state.leaderboard) return new PolicyDenial({ message: 'Leaderboard not found' }, 404)

    this.ctx.state.alias = await this.em.getRepository(PlayerAlias).findOne({
      id: Number(this.ctx.state.currentAliasId),
      player: {
        game: this.ctx.state.key.game
      }
    })

    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.WRITE_LEADERBOARDS)
  }
}
