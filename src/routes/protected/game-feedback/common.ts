import { Next } from 'koa'
import GameFeedbackCategory from '../../../entities/game-feedback-category'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { GameRouteState } from '../../../middleware/game-middleware'

type FeedbackCategoryRouteContext = ProtectedRouteContext<
  GameRouteState & { feedbackCategory: GameFeedbackCategory }
>

export async function loadFeedbackCategory(ctx: FeedbackCategoryRouteContext, next: Next) {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const feedbackCategory = await em.repo(GameFeedbackCategory).findOne({
    id: Number(id),
    game: ctx.state.game
  })

  if (!feedbackCategory) {
    return ctx.throw(404, 'Feedback category not found')
  }

  ctx.state.feedbackCategory = feedbackCategory
  await next()
}
