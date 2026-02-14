import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { loadFeedbackCategory } from './common'
import { loadGame } from '../../../middleware/game-middleware'

export const deleteCategoryRoute = protectedRoute({
  method: 'delete',
  path: '/categories/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'delete feedback categories'),
    loadGame,
    loadFeedbackCategory
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const feedbackCategory = ctx.state.feedbackCategory

    createGameActivity(em, {
      user: ctx.state.user,
      game: feedbackCategory.game,
      type: GameActivityType.GAME_FEEDBACK_CATEGORY_DELETED,
      extra: {
        feedbackCategoryInternalName: feedbackCategory.internalName
      }
    })

    await em.remove(feedbackCategory).flush()

    return {
      status: 204
    }
  }
})
