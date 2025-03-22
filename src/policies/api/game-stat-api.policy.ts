import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'
import GameStat from '../../entities/game-stat'
import Player from '../../entities/player'
import Policy from '../policy'

export default class GameStatAPIPolicy extends Policy {
  async getStat(req: Request): Promise<GameStat | null> {
    const { internalName } = req.params
    const key = this.getAPIKey()
    const stat = await this.em.getRepository(GameStat).findOne({
      internalName,
      game: key.game
    })

    this.ctx.state.stat = stat
    return stat
  }

  async getAllStats(): Promise<Array<GameStat> | null> {
    const key = this.getAPIKey()
    const stats = await this.em.getRepository(GameStat).find({
      game: key.game
    })
    return stats
  }

  async index(): Promise<PolicyResponse> {
    this.ctx.state.gameStats = await this.getAllStats()
    if (!this.ctx.state.gameStats) return new PolicyDenial({ message: 'Stats not found ' }, 404)

    return this.hasScope(APIKeyScope.READ_GAME_STATS)
  }

  async get(req: Request): Promise<PolicyResponse> {
    await this.getStat(req)
    if (!this.ctx.state.stat) return new PolicyDenial({ message: 'Stat not found ' }, 404)

    return this.hasScope(APIKeyScope.READ_GAME_STATS)
  }

  async getPlayer(): Promise<Player | null> {
    const key = this.getAPIKey()

    const player = await this.em.getRepository(Player).findOne({
      id: this.ctx.state.currentPlayerId,
      game: key.game
    })

    this.ctx.state.player = player
    return player
  }

  async put(req: Request): Promise<PolicyResponse> {
    const [stat, player] = await Promise.all([this.getStat(req), this.getPlayer()])
    if (!stat) return new PolicyDenial({ message: 'Stat not found' }, 404)
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.hasScope(APIKeyScope.WRITE_GAME_STATS)
  }

  async history(req: Request): Promise<PolicyResponse> {
    const [stat, player] = await Promise.all([this.getStat(req), this.getPlayer()])
    if (!stat) return new PolicyDenial({ message: 'Stat not found' }, 404)
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return this.hasScope(APIKeyScope.READ_GAME_STATS)
  }
}
