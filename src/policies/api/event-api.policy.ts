import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key.js'
import Player from '../../entities/player.js'
import Policy from '../policy.js'

export default class EventAPIPolicy extends Policy {
  async post(req: Request): Promise<PolicyResponse> {
    const key = await this.getAPIKey()
    req.ctx.state.player = await this.em.getRepository(Player).findOne({
      aliases: {
        id: this.ctx.state.currentAliasId
      },
      game: key.game
    }, {
      populate: ['aliases']
    })

    if (!req.ctx.state.player) return new PolicyDenial({ message: 'Player not found' }, 404)
    return await this.hasScope(APIKeyScope.WRITE_EVENTS)
  }
}
