import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'
import GameStat from '../../entities/game-stat'
import Player from '../../entities/player'
import Policy from '../policy'
import PlayerAlias from '../../entities/player-alias'
import { getResultCacheOptions } from '../../lib/perf/getResultCacheOptions'

export default class GameStatAPIPolicy extends Policy {
  async getStat(req: Request): Promise<GameStat | null> {
    const { internalName } = req.params
    const key = this.getAPIKey()
    const stat = await this.em.repo(GameStat).findOne({
      internalName,
      game: key.game
    }, getResultCacheOptions(`stat-api-policy-stat-${internalName}`))

    this.ctx.state.stat = stat
    return stat
  }

  async getAlias(): Promise<PlayerAlias | null> {
    const key = this.getAPIKey()

    const alias = await this.em.repo(PlayerAlias).findOne({
      id: this.ctx.state.currentAliasId,
      player: {
        game: key.game
      }
    }, {
      ...(getResultCacheOptions(`stat-api-policy-alias-${this.ctx.state.currentAliasId}`) ?? {}),
      populate: ['player']
    })

    this.ctx.state.alias = alias
    return alias
  }

  async getPlayer(): Promise<Player | null> {
    const key = this.getAPIKey()

    const player = await this.em.repo(Player).findOne({
      id: this.ctx.state.currentPlayerId,
      game: key.game
    }, getResultCacheOptions(`stat-api-policy-player-${this.ctx.state.currentPlayerId}`))

    this.ctx.state.player = player
    return player
  }

  async index(): Promise<PolicyResponse> {
    return this.hasScope(APIKeyScope.READ_GAME_STATS)
  }

  async get(req: Request): Promise<PolicyResponse> {
    const stat = await this.getStat(req)
    if (!stat) return new PolicyDenial({ message: 'Stat not found' }, 404)

    return this.hasScope(APIKeyScope.READ_GAME_STATS)
  }

  async getPlayerStat(req: Request): Promise<PolicyResponse> {
    const [stat, alias] = await Promise.all([this.getStat(req), this.getAlias()])
    if (!stat) return new PolicyDenial({ message: 'Stat not found' }, 404)
    if (!alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.hasScope(APIKeyScope.READ_GAME_STATS)
  }

  async put(req: Request): Promise<PolicyResponse> {
    const [stat, alias] = await Promise.all([this.getStat(req), this.getAlias()])
    if (!stat) return new PolicyDenial({ message: 'Stat not found' }, 404)
    if (!alias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.hasScope(APIKeyScope.WRITE_GAME_STATS)
  }

  async history(req: Request): Promise<PolicyResponse> {
    const [stat, player] = await Promise.all([this.getStat(req), this.getPlayer()])
    if (!stat) return new PolicyDenial({ message: 'Stat not found' }, 404)
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.hasScope(APIKeyScope.READ_GAME_STATS)
  }

  async globalHistory(req: Request): Promise<PolicyResponse> {
    const stat = await this.getStat(req)
    if (!stat) return new PolicyDenial({ message: 'Stat not found' }, 404)

    return this.hasScope(APIKeyScope.READ_GAME_STATS)
  }
}
