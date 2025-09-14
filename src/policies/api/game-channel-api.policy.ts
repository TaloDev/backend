import Policy from '../policy'
import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'
import PlayerAlias from '../../entities/player-alias'
import { EntityManager } from '@mikro-orm/mysql'
import GameChannel from '../../entities/game-channel'
import { getResultCacheOptions } from '../../lib/perf/getResultCacheOptions'

export default class GameChannelAPIPolicy extends Policy {
  async getAlias(): Promise<PlayerAlias | null> {
    const em: EntityManager = this.ctx.em
    const id = this.ctx.state.currentAliasId

    return em.getRepository(PlayerAlias).findOne({
      id,
      player: {
        game: this.ctx.state.game
      }
    }, getResultCacheOptions(`game-channel-api-policy-alias-${id}`))
  }

  async getChannel(req: Request): Promise<GameChannel | null> {
    const em: EntityManager = this.ctx.em
    const id = Number(req.params.id)

    return em.getRepository(GameChannel).findOne({
      id,
      game: this.ctx.state.game
    }, {
      populate: ['members:ref'],
      ...getResultCacheOptions(`game-channel-api-policy-channel-${id}`)
    })
  }

  async index(): Promise<PolicyResponse> {
    return this.hasScope(APIKeyScope.READ_GAME_CHANNELS)
  }

  async get(req: Request): Promise<PolicyResponse> {
    this.ctx.state.channel = await this.getChannel(req)
    if (!this.ctx.state.channel) return new PolicyDenial({ message: 'Channel not found' }, 404)

    return this.hasScope(APIKeyScope.READ_GAME_CHANNELS)
  }

  async subscriptions(): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.hasScope(APIKeyScope.READ_GAME_CHANNELS)
  }

  async post(): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }

  async join(req: Request): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.channel = await this.getChannel(req)
    if (!this.ctx.state.channel) return new PolicyDenial({ message: 'Channel not found' }, 404)

    return this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }

  async leave(req: Request): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.channel = await this.getChannel(req)
    if (!this.ctx.state.channel) return new PolicyDenial({ message: 'Channel not found' }, 404)

    return this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }

  async put(req: Request): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.channel = await this.getChannel(req)
    if (!this.ctx.state.channel) return new PolicyDenial({ message: 'Channel not found' }, 404)

    return this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }

  async delete(req: Request): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.channel = await this.getChannel(req)
    if (!this.ctx.state.channel) return new PolicyDenial({ message: 'Channel not found' }, 404)

    return this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }

  async invite(req: Request): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.channel = await this.getChannel(req)
    if (!this.ctx.state.channel) return new PolicyDenial({ message: 'Channel not found' }, 404)

    return this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }

  async members(req: Request): Promise<PolicyResponse> {
    this.ctx.state.channel = await this.getChannel(req)
    if (!this.ctx.state.channel) return new PolicyDenial({ message: 'Channel not found' }, 404)

    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.hasScope(APIKeyScope.READ_GAME_CHANNELS)
  }

  async getStorage(req: Request): Promise<PolicyResponse> {
    this.ctx.state.channel = await this.getChannel(req)
    if (!this.ctx.state.channel) return new PolicyDenial({ message: 'Channel not found' }, 404)

    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.hasScope(APIKeyScope.READ_GAME_CHANNELS)
  }

  async putStorage(req: Request): Promise<PolicyResponse> {
    this.ctx.state.channel = await this.getChannel(req)
    if (!this.ctx.state.channel) return new PolicyDenial({ message: 'Channel not found' }, 404)

    this.ctx.state.alias = await this.getAlias()
    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }
}
