import Policy from '../policy'
import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'
import PlayerGroup from '../../entities/player-group'

export default class PlayerGroupAPIPolicy extends Policy {
  async get(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const key = await this.getAPIKey()
    const group = await this.em.getRepository(PlayerGroup).findOne({
      id,
      game: key.game
    })

    this.ctx.state.group = group
    if (!group) return new PolicyDenial({ message: 'Group not found' }, 404)

    return await this.hasScope(APIKeyScope.READ_PLAYER_GROUPS)
  }
}
