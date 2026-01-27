import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { loadIntegration, addStatSyncJob } from './common'

export const syncStatsRoute = protectedRoute({
  method: 'post',
  path: '/:id/sync-stats',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'sync stats'),
    loadIntegration
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const integration = ctx.state.integration

    if (!integration.getConfig().syncStats) {
      ctx.throw(400, 'Stat syncing is not enabled')
    }

    await addStatSyncJob(integration.id)

    createGameActivity(em, {
      user: ctx.state.authenticatedUser,
      game: ctx.state.game,
      type: GameActivityType.GAME_INTEGRATION_STEAMWORKS_STATS_SYNCED
    })

    await em.flush()

    return {
      status: 204
    }
  }
})
