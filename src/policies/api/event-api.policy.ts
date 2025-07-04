import { PolicyDenial, PolicyResponse } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'
import Player from '../../entities/player'
import Policy from '../policy'
import { getResultCacheOptions } from '../../lib/perf/getResultCacheOptions'

export default class EventAPIPolicy extends Policy {
  async post(): Promise<PolicyResponse> {
    const key = this.getAPIKey()
    this.ctx.state.player = await this.em.getRepository(Player).findOne({
      aliases: {
        id: this.ctx.state.currentAliasId
      },
      game: key.game
    }, {
      populate: ['aliases'],
      ...(getResultCacheOptions(`event-api-policy-alias-${this.ctx.state.currentAliasId}`) ?? {})
    })

    if (!this.ctx.state.player) return new PolicyDenial({ message: 'Player not found' }, 404)
    return await this.hasScope(APIKeyScope.WRITE_EVENTS)
  }
}
