import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'
import Player from '../../entities/player'
import Policy from '../policy'

export default class PlayerAPIPolicy extends Policy {
  async identify(): Promise<PolicyResponse> {
    return this.hasScope(APIKeyScope.READ_PLAYERS)
  }

  async get(): Promise<PolicyResponse> {
    return this.hasScope(APIKeyScope.READ_PLAYERS)
  }

  async patch(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const key = await this.getAPIKey()

    this.ctx.state.player = await this.em.getRepository(Player).findOne({
      id: id,
      game: key.game
    })

    if (!this.ctx.state.player) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.WRITE_PLAYERS)
  }

  async merge(): Promise<PolicyResponse> {
    return await this.hasScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
  }
}
