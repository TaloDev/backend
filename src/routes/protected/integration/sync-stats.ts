import { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadIntegration, addStatSyncJob } from './common.js'

export const syncStatsRoute = protectedRoute({
  method: 'post',
  path: '/:id/sync-stats',
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'sync stats'), loadIntegration),
  handler: async (ctx) => {
    const em = ctx.em
    const integration = ctx.state.integration

    if (!integration.getSteamConfig().syncStats) {
      return ctx.throw(400, 'Stat syncing is not enabled')
    }

    await addStatSyncJob(integration.id)

    createGameActivity(em, {
      user: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.GAME_INTEGRATION_STEAMWORKS_STATS_SYNCED,
    })

    await em.flush()

    return {
      status: 204,
    }
  },
})
