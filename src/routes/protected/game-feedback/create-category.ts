import { GameActivityType } from '../../../entities/game-activity'
import GameFeedbackCategory from '../../../entities/game-feedback-category'
import { UserType } from '../../../entities/user'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'

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
