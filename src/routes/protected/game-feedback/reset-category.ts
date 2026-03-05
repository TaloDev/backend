import { FilterQuery } from '@mikro-orm/mysql'
import { GameActivityType } from '../../../entities/game-activity'
import GameFeedback from '../../../entities/game-feedback'
import { UserType } from '../../../entities/user'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { resetModes, translateResetMode } from '../../../lib/validation/resetModeValidation'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { loadFeedbackCategory } from './common'

export const resetCategoryRoute = protectedRoute({
  method: 'delete',
  path: '/categories/:id/feedback',
  schema: (z) => ({
    query: z.object({
      mode: z
        .enum(resetModes, {
          error: `Mode must be one of: ${resetModes.join(', ')}`,
        })
        .optional()
        .default('all'),
    }),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'reset feedback'),
    loadGame,
    loadFeedbackCategory,
  ),
  handler: async (ctx) => {
    const { mode } = ctx.state.validated.query
    const em = ctx.em
    const feedbackCategory = ctx.state.feedbackCategory

    const where: FilterQuery<GameFeedback> = { category: feedbackCategory }

    if (mode === 'dev') {
      where.playerAlias = {
        player: { devBuild: true },
      }
    } else if (mode === 'live') {
      where.playerAlias = {
        player: { devBuild: false },
      }
    }

    const deletedCount = await em.fork().transactional(async (trx) => {
      const deletedCount = await trx.repo(GameFeedback).nativeDelete(where)

      createGameActivity(trx, {
        user: ctx.state.user,
        game: feedbackCategory.game,
        type: GameActivityType.GAME_FEEDBACK_CATEGORY_RESET,
        extra: {
          feedbackCategoryInternalName: feedbackCategory.internalName,
          display: {
            'Reset mode': translateResetMode(mode),
            'Deleted count': deletedCount,
          },
        },
      })

      return deletedCount
    })

    return {
      status: 200,
      body: {
        deletedCount,
      },
    }
  },
})
