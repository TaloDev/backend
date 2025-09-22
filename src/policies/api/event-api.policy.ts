import { PolicyDenial, PolicyResponse } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'
import Policy from '../policy'
import { getResultCacheOptions } from '../../lib/perf/getResultCacheOptions'
import PlayerAlias from '../../entities/player-alias'

export default class EventAPIPolicy extends Policy {
  async post(): Promise<PolicyResponse> {
    this.ctx.state.alias = await this.em.repo(PlayerAlias).findOne({
      id: this.ctx.state.currentAliasId,
      player: {
        game: this.getAPIKey().game
      }
    }, {
      ...getResultCacheOptions(`event-api-policy-alias-${this.ctx.state.currentAliasId}`),
      fields: ['id', 'player.game.id', 'player.props:ref', 'player.devBuild']
    })

    if (!this.ctx.state.alias) return new PolicyDenial({ message: 'Player not found' }, 404)
    return await this.hasScope(APIKeyScope.WRITE_EVENTS)
  }
}
