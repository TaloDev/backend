import Policy from '../policy'
import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'
import GameFeedbackCategory from '../../entities/game-feedback-category'
import PlayerAlias from '../../entities/player-alias'

export default class GameFeedbackAPIPolicy extends Policy {
  async indexCategories(): Promise<PolicyResponse> {
    return await this.hasScope(APIKeyScope.READ_GAME_FEEDBACK)
  }

  async post(req: Request): Promise<PolicyResponse> {
    const { internalName } = req.params

    const key = this.getAPIKey()
    const category = await this.em.getRepository(GameFeedbackCategory).findOne({
      internalName,
      game: key.game
    })

    this.ctx.state.category = category
    if (!category) return new PolicyDenial({ message: 'Feedback category not found' }, 404)

    const playerAlias = await this.em.getRepository(PlayerAlias).findOne({
      id: Number(this.ctx.state.currentAliasId),
      player: {
        game: this.ctx.state.key.game
      }
    })

    this.ctx.state.alias = playerAlias
    if (!playerAlias) return new PolicyDenial({ message: 'Player not found' }, 404)

    return await this.hasScope(APIKeyScope.WRITE_GAME_FEEDBACK)
  }
}
