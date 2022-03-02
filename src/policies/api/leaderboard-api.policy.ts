import Policy from '../policy'
import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import Leaderboard from '../../entities/leaderboard'
import PlayerAlias from '../../entities/player-alias'

export default class LeaderboardAPIPolicy extends Policy {
  async getLeaderboard(req: Request): Promise<Leaderboard | null> {
    const { internalName } = req.params

    const key = await this.getAPIKey()
    const leaderboard = await this.em.getRepository(Leaderboard).findOne({
      internalName,
      game: key.game
    })

    this.ctx.state.leaderboard = leaderboard

    return leaderboard
  }

  async get(req: Request): Promise<PolicyResponse> {
    const scopeCheck = await this.hasScope('read:leaderboards')
    if (scopeCheck !== true) return scopeCheck

    const leaderboard = await this.getLeaderboard(req)
    if (!leaderboard) return new PolicyDenial({ message: 'Leaderboard not found' }, 404)

    return await true
  }

  async post(req: Request): Promise<PolicyResponse> {
    const scopeCheck = await this.hasScope('write:leaderboards')
    if (scopeCheck !== true) return scopeCheck

    const leaderboard = await this.getLeaderboard(req)
    if (!leaderboard) return new PolicyDenial({ message: 'Leaderboard not found' }, 404)

    const { aliasId } = req.body

    const playerAlias = await this.em.getRepository(PlayerAlias).findOne({
      id: aliasId,
      player: {
        game: this.ctx.state.key.game
      }
    })

    if (!playerAlias) return new PolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.playerAlias = playerAlias

    return true
  }
}
