import { Next } from 'koa'
import GameFeedback from '../../../entities/game-feedback'
import GameFeedbackCategory from '../../../entities/game-feedback-category'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { GameRouteState } from '../../../middleware/game-middleware'

type FeedbackCategoryRouteContext = ProtectedRouteContext<
  GameRouteState & { feedbackCategory: GameFeedbackCategory }
>

type FeedbackRouteContext = ProtectedRouteContext<GameRouteState & { feedback: GameFeedback }>

export async function loadFeedbackCategory(ctx: FeedbackCategoryRouteContext, next: Next) {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const feedbackCategory = await em.repo(GameFeedbackCategory).findOne({
    id: Number(id),
    game: ctx.state.game,
  })

  if (!feedbackCategory) {
    return ctx.throw(404, 'Feedback category not found')
  }

  ctx.state.feedbackCategory = feedbackCategory
  await next()
}

export async function loadFeedback(ctx: FeedbackRouteContext, next: Next) {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const feedback = await em.repo(GameFeedback).findOne(
    {
      id: Number(id),
      category: { game: ctx.state.game },
    },
    {
      populate: ['playerAlias'],
    },
  )

  if (!feedback) {
    return ctx.throw(404, 'Feedback not found')
  }

  ctx.state.feedback = feedback
  await next()
}
