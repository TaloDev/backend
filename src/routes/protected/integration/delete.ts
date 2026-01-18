import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { loadIntegration } from './common'

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'delete integrations'),
    loadIntegration
  ),
  handler: async (ctx) => {
    const em = ctx.em

    const integration = ctx.state.integration
    integration.deletedAt = new Date()

    createGameActivity(em, {
      user: ctx.state.authenticatedUser,
      game: ctx.state.game,
      type: GameActivityType.GAME_INTEGRATION_DELETED,
      extra: {
        integrationType: integration.type
      }
    })

    await em.flush()

    return {
      status: 204
    }
  }
})
