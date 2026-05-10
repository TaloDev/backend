import { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadIntegration, addLeaderboardSyncJob } from './common.js'

export const syncLeaderboardsRoute = protectedRoute({
  method: 'post',
  path: '/:id/sync-leaderboards',
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'sync leaderboards'), loadIntegration),
  handler: async (ctx) => {
    const em = ctx.em
    const integration = ctx.state.integration

    if (!integration.getSteamConfig().syncLeaderboards) {
      return ctx.throw(400, 'Leaderboard syncing is not enabled')
    }

    await addLeaderboardSyncJob(integration.id)

    createGameActivity(em, {
      user: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.GAME_INTEGRATION_STEAMWORKS_LEADERBOARDS_SYNCED,
    })

    await em.flush()

    return {
      status: 204,
    }
  },
})
