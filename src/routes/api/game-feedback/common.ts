import type { Next } from 'koa'
import { APIRouteContext } from '../../../lib/routing/context'
import GameFeedbackCategory from '../../../entities/game-feedback-category'
import { PlayerAliasRouteState } from '../../../middleware/player-alias-middleware'

type GameFeedbackCategoryRouteContext = APIRouteContext<
  PlayerAliasRouteState & {
    category: GameFeedbackCategory
    continuityDate?: Date
  }
>

export const loadCategory = async (ctx: GameFeedbackCategoryRouteContext, next: Next) => {
  const { internalName } = ctx.params

  const category = await ctx.em.repo(GameFeedbackCategory).findOne({
    internalName,
    game: ctx.state.game
  })

  if (!category) {
    ctx.throw(404, 'Feedback category not found')
  }

  ctx.state.category = category

  await next()
}
