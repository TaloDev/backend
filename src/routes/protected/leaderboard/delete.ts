import { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadLeaderboard } from './common.js'

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'delete leaderboards'),
    loadGame,
    loadLeaderboard(),
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const leaderboard = ctx.state.leaderboard
    const leaderboardInternalName = leaderboard.internalName

    createGameActivity(em, {
      user: ctx.state.user,
      game: leaderboard.game,
      type: GameActivityType.LEADERBOARD_DELETED,
      extra: {
        leaderboardInternalName,
      },
    })

    await em.remove(leaderboard).flush()

    await triggerIntegrations(em, leaderboard.game, (integration) => {
      return integration.handleLeaderboardDeleted(em, leaderboardInternalName)
    })

    return {
      status: 204,
    }
  },
})
