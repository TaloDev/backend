import { z } from 'zod'
import { GameActivityType } from '../../../entities/game-activity.js'
import GameFeedback from '../../../entities/game-feedback.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { ProtectedRouteState } from '../../../lib/routing/state.js'
import { GameRouteState, loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadFeedback } from './common.js'

type FeedbackRouteState = ProtectedRouteState & GameRouteState & { feedback: GameFeedback }

const toggleArchivedSchema = (zod: typeof z) => ({
  body: zod.object({
    archived: zod.boolean(),
  }),
})

type ToggleArchivedSchema = ReturnType<typeof toggleArchivedSchema>

export const toggleArchivedRoute = protectedRoute<FeedbackRouteState, ToggleArchivedSchema>({
  method: 'patch',
  path: '/:id/toggle-archived',
  schema: toggleArchivedSchema,
  middleware: withMiddleware<FeedbackRouteState>(
    userTypeGate([UserType.ADMIN, UserType.DEV], 'archive feedback'),
    loadGame,
    loadFeedback,
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const feedback = ctx.state.feedback
    const { archived } = ctx.state.validated.body

    feedback.deletedAt = archived ? new Date() : null

    const aliasIdentifier = feedback.anonymised ? null : feedback.playerAlias.identifier

    createGameActivity(em, {
      user: ctx.state.user,
      game: ctx.state.game,
      type: archived
        ? GameActivityType.GAME_FEEDBACK_ARCHIVED
        : GameActivityType.GAME_FEEDBACK_RESTORED,
      extra: {
        aliasIdentifier,
      },
    })

    await em.flush()

    return {
      status: 200,
      body: {
        feedback,
      },
    }
  },
})
