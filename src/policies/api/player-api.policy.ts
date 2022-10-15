import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import Player from '../../entities/player'
import Policy from '../policy'

export default class PlayerAPIPolicy extends Policy {
  async identify(): Promise<PolicyResponse> {
    return await this.hasScope('read:players')
  }

  async patch(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const key = await this.getAPIKey()

    req.ctx.state.player = await this.em.getRepository(Player).findOne({
      id: id,
      game: key.game
    })

    if (!req.ctx.state.player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope('write:players')
  }

  async merge(): Promise<PolicyResponse> {
    return await this.hasScopes(['read:players', 'write:players'])
  }
}
