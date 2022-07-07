import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import Player from '../../entities/player'
import Policy from '../policy'

export default class PlayerAPIPolicy extends Policy {
  async identify(): Promise<PolicyResponse> {
    return await this.hasScope('read:players')
  }

  async patch(req: Request): Promise<PolicyResponse> {
    const { aliasId } = req.params

    const key = await this.getAPIKey()

    const player = await this.em.getRepository(Player).findOne({
      aliases: {
        id: Number(aliasId)
      },
      game: key.game
    })

    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    req.ctx.state.player = player

    return await this.hasScope('write:players')
  }

  async merge(): Promise<PolicyResponse> {
    return await this.hasScopes(['read:players', 'write:players'])
  }
}
