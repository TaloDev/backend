import type { Next } from 'koa'
import GameFeedbackCategory from '../../../entities/game-feedback-category'
import { APIRouteContext } from '../../../lib/routing/context'
import { PlayerAliasRouteState } from '../../../middleware/player-alias-middleware'

type GameFeedbackCategoryRouteContext = APIRouteContext<
  PlayerAliasRouteState & {
    category: GameFeedbackCategory
  }
>

export async function loadCategory(ctx: GameFeedbackCategoryRouteContext, next: Next) {
  const { internalName } = ctx.params

  const category = await ctx.em.repo(GameFeedbackCategory).findOne({
    internalName,
    game: ctx.state.game,
  })

  if (!category) {
    return ctx.throw(404, 'Feedback category not found')
  }

  ctx.state.category = category

  await next()
}
