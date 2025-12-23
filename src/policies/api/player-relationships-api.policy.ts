import { PolicyDenial, PolicyResponse } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'
import Policy from '../policy'
import PlayerAlias from '../../entities/player-alias'

export default class PlayerRelationshipsAPIPolicy extends Policy {
  async getAlias() {
    return this.em.repo(PlayerAlias).findOne({
      id: this.ctx.state.currentAliasId,
      player: {
        game: this.ctx.state.game
      }
    })
  }

  async post(): Promise<PolicyResponse> {
    this.ctx.state.currentAlias = await this.getAlias()
    if (!this.ctx.state.currentAlias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.WRITE_PLAYER_RELATIONSHIPS)
  }

  async confirm(): Promise<PolicyResponse> {
    this.ctx.state.currentAlias = await this.getAlias()
    if (!this.ctx.state.currentAlias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.WRITE_PLAYER_RELATIONSHIPS)
  }

  async getSubscribers(): Promise<PolicyResponse> {
    this.ctx.state.currentAlias = await this.getAlias()
    if (!this.ctx.state.currentAlias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.READ_PLAYER_RELATIONSHIPS)
  }

  async getSubscriptions(): Promise<PolicyResponse> {
    this.ctx.state.currentAlias = await this.getAlias()
    if (!this.ctx.state.currentAlias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.READ_PLAYER_RELATIONSHIPS)
  }

  async delete(): Promise<PolicyResponse> {
    this.ctx.state.currentAlias = await this.getAlias()
    if (!this.ctx.state.currentAlias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.WRITE_PLAYER_RELATIONSHIPS)
  }
}
