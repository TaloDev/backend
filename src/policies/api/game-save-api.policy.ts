import Policy from '../policy'
import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import GameSave from '../../entities/game-save'
import Player from '../../entities/player'

export default class GameSaveAPIPolicy extends Policy {
  async getPlayer(): Promise<Player> {
    const key = await this.getAPIKey()

    return await this.em.getRepository(Player).findOne({
      id: this.ctx.state.currentPlayerId,
      game: key.game
    })
  }

  async index(): Promise<PolicyResponse> {
    this.ctx.state.player = await this.getPlayer()
    if (!this.ctx.state.player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope('read:gameSaves')
  }

  async post(): Promise<PolicyResponse> {
    this.ctx.state.player = await this.getPlayer()
    if (!this.ctx.state.player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope('write:gameSaves')
  }

  async patch(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    this.ctx.state.save = await this.em.getRepository(GameSave).findOne({
      id: Number(id),
      player: await this.getPlayer()
    })

    if (!this.ctx.state.save) return new PolicyDenial({ message: 'Save not found' }, 404)

    return await this.hasScope('write:gameSaves')
  }
}
