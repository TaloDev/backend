import { GameActivityType } from '../../../entities/game-activity.js'
import GameFeedbackCategory from '../../../entities/game-feedback-category.js'
import { UserType } from '../../../entities/user.js'
import { buildErrorResponse } from '../../../lib/errors/buildErrorResponse.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'

export const createCategoryRoute = protectedRoute({
  method: 'post',
  path: '/categories',
  schema: (z) => ({
    body: z.object({
      internalName: z.string(),
      name: z.string(),
      description: z.string(),
      anonymised: z.boolean(),
    }),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN, UserType.DEV], 'create feedback categories'),
    loadGame,
  ),
  handler: async (ctx) => {
    const { internalName, name, description, anonymised } = ctx.state.validated.body
    const em = ctx.em

    const existingCategory = await em.repo(GameFeedbackCategory).findOne({
      internalName,
      game: ctx.state.game,
    })

    if (existingCategory) {
      return buildErrorResponse({
        internalName: [
          `A feedback category with the internalName '${internalName}' already exists`,
        ],
      })
    }

    const feedbackCategory = new GameFeedbackCategory(ctx.state.game)
    feedbackCategory.internalName = internalName
    feedbackCategory.name = name
    feedbackCategory.description = description
    feedbackCategory.anonymised = anonymised

    createGameActivity(em, {
      user: ctx.state.user,
      game: feedbackCategory.game,
      type: GameActivityType.GAME_FEEDBACK_CATEGORY_CREATED,
      extra: {
        feedbackCategoryInternalName: feedbackCategory.internalName,
      },
    })

    await em.persist(feedbackCategory).flush()

    return {
      status: 200,
      body: {
        feedbackCategory,
      },
    }
  },
})
