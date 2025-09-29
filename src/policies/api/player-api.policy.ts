import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'
import Player from '../../entities/player'
import Policy from '../policy'
import PlayerAlias from '../../entities/player-alias'

export default class PlayerAPIPolicy extends Policy {
  async identify(): Promise<PolicyResponse> {
    return this.hasScope(APIKeyScope.READ_PLAYERS)
  }

  async get(): Promise<PolicyResponse> {
    return this.hasScope(APIKeyScope.READ_PLAYERS)
  }

  async patch(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const key = this.getAPIKey()

    this.ctx.state.player = await this.em.repo(Player).findOne({
      id: id,
      game: key.game
    })

    if (!this.ctx.state.player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.WRITE_PLAYERS)
  }

  async merge(): Promise<PolicyResponse> {
    return await this.hasScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
  }

  async search(): Promise<PolicyResponse> {
    return this.hasScope(APIKeyScope.READ_PLAYERS)
  }

  async socketToken(): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.em.repo(PlayerAlias).findOne({
      id: this.ctx.state.currentAliasId,
      player: {
        game: this.getAPIKey().game
      }
    })

    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.WRITE_PLAYERS)
  }
}
