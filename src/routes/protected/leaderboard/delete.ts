import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations'
import { loadLeaderboard } from './common'

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'delete leaderboards'),
    loadGame,
    loadLeaderboard()
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const leaderboard = ctx.state.leaderboard
    const leaderboardInternalName = leaderboard.internalName

    createGameActivity(em, {
      user: ctx.state.authenticatedUser,
      game: leaderboard.game,
      type: GameActivityType.LEADERBOARD_DELETED,
      extra: {
        leaderboardInternalName
      }
    })

    await em.remove(leaderboard).flush()

    await triggerIntegrations(em, leaderboard.game, (integration) => {
      return integration.handleLeaderboardDeleted(em, leaderboardInternalName)
    })

    return {
      status: 204
    }
  }
})
