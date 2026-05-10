import { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadIntegration } from './common.js'

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'delete integrations'),
    loadIntegration,
  ),
  handler: async (ctx) => {
    const em = ctx.em

    const integration = ctx.state.integration
    integration.deletedAt = new Date()

    createGameActivity(em, {
      user: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.GAME_INTEGRATION_DELETED,
      extra: {
        integrationType: integration.type,
      },
    })

    await em.flush()

    return {
      status: 204,
    }
  },
})
