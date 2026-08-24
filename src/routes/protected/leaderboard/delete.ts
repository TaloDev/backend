import { EntityManager } from '@mikro-orm/mysql'
import AdminAPIKey from '../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import Leaderboard from '../../../entities/leaderboard.js'
import User, { UserType } from '../../../entities/user.js'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadLeaderboard } from './common.js'

export async function deleteLeaderboardHandler({
  em,
  leaderboard,
  actor,
}: {
  em: EntityManager
  leaderboard: Leaderboard
  actor: User | AdminAPIKey
}) {
  const leaderboardInternalName = leaderboard.internalName

  createGameActivity(em, {
    actor,
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
}

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'delete leaderboards'),
    loadGame,
    loadLeaderboard(),
  ),
  handler: (ctx) =>
    deleteLeaderboardHandler({
      em: ctx.em,
      leaderboard: ctx.state.leaderboard,
      actor: ctx.state.user,
    }),
})
