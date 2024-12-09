import Policy from '../policy'
import { PolicyDenial, PolicyResponse } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'
import PlayerAlias from '../../entities/player-alias'
import { EntityManager } from '@mikro-orm/mysql'

export default class GameChannelAPIPolicy extends Policy {
  async getAlias(): Promise<PlayerAlias | null> {
    const em: EntityManager = this.ctx.em
    return await em.getRepository(PlayerAlias).findOne({
      id: this.ctx.state.currentAliasId,
      player: {
        game: this.ctx.state.game
      }
    })
  }

  async index(): Promise<PolicyResponse> {
    return await this.hasScope(APIKeyScope.READ_GAME_CHANNELS)
  }

  async subscriptions(): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.READ_GAME_CHANNELS)
  }

  async post(): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }

  async join(): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }

  async leave(): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }

  async put(): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }

  async delete(): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }
}
