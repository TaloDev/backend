import Policy from './policy'
import { PolicyResponse, PolicyDenial, Request } from 'koa-clay'
import { UserType } from '../entities/user'
import GameStat from '../entities/game-stat'
import UserTypeGate from './user-type-gate'
import PlayerGameStat from '../entities/player-game-stat'

export default class GameStatPolicy extends Policy {
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  @UserTypeGate([UserType.ADMIN, UserType.DEV], 'create stats')
  async post(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  async getStat(id: number): Promise<GameStat> {
    this.ctx.state.stat = await this.em.getRepository(GameStat).findOne(Number(id), { populate: ['game'] })
    return this.ctx.state.stat
  }

  async put(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const stat = await this.getStat(Number(id))
    if (!stat) return new PolicyDenial({ message: 'Stat not found' }, 404)

    return await this.canAccessGame(stat.game.id)
  }

  @UserTypeGate([UserType.ADMIN], 'delete stats')
  async delete(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const stat = await this.getStat(Number(id))
    if (!stat) return new PolicyDenial({ message: 'Stat not found' }, 404)

    return await this.canAccessGame(stat.game.id)
  }

  @UserTypeGate([UserType.ADMIN], 'update player stats')
  async updatePlayerStat(req: Request): Promise<PolicyResponse> {
    const { id, playerStatId } = req.params

    const stat = await this.getStat(Number(id))
    if (!stat) return new PolicyDenial({ message: 'Stat not found' }, 404)

    const playerStat = await this.em.getRepository(PlayerGameStat).findOne({
      id: Number(playerStatId),
      stat: {
        id: Number(id) // slightly redundant but enforces correct usage
      }
    }, {
      populate: ['player']
    })
    this.ctx.state.playerStat = playerStat

    if (!playerStat) return new PolicyDenial({ message: 'Player stat not found' }, 404)

    return this.canAccessGame(stat.game.id)
  }

  @UserTypeGate([UserType.ADMIN], 'reset stats')
  async reset(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const stat = await this.getStat(Number(id))
    if (!stat) return new PolicyDenial({ message: 'Stat not found' }, 404)

    return await this.canAccessGame(stat.game.id)
  }
}
