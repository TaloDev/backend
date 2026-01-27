import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import updateAllowedKeys from '../../../lib/entities/updateAllowedKeys'
import { loadFeedbackCategory } from './common'
import { loadGame } from '../../../middleware/game-middleware'

export const updateCategoryRoute = protectedRoute({
  method: 'put',
  path: '/categories/:id',
  schema: (z) => ({
    body: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      anonymised: z.boolean().optional()
    })
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN, UserType.DEV], 'update feedback categories'),
    loadGame,
    loadFeedbackCategory
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const body = ctx.state.validated.body

    const [feedbackCategory, changedProperties] = updateAllowedKeys(
      ctx.state.feedbackCategory,
      body,
      ['name', 'description', 'anonymised']
    )

    createGameActivity(em, {
      user: ctx.state.authenticatedUser,
      game: feedbackCategory.game,
      type: GameActivityType.GAME_FEEDBACK_CATEGORY_UPDATED,
      extra: {
        feedbackCategoryInternalName: feedbackCategory.internalName,
        display: {
          'Updated properties': changedProperties.map((prop) => `${prop}: ${body[prop as keyof typeof body]}`).join(', ')
        }
      }
    })

    await em.flush()

    return {
      status: 200,
      body: {
        feedbackCategory
      }
    }
  }
})
