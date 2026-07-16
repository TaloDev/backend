import { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import { getAdminTokenCacheKey } from '../../../lib/auth/getAdminAPIKeyFromToken.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate, requireEmailConfirmed } from '../../../middleware/policy-middleware.js'
import { loadAdminAPIKey } from './common.js'

export const revokeRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'revoke admin API keys'),
    requireEmailConfirmed('revoke admin API keys'),
    loadGame,
    loadAdminAPIKey,
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const apiKey = ctx.state.adminAPIKey

    apiKey.revokedAt = new Date()
    await em.clearCache(getAdminTokenCacheKey(apiKey.keyHash))

    createGameActivity(em, {
      actor: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.ADMIN_API_KEY_REVOKED,
      extra: {
        keyId: apiKey.id,
        display: {
          'Key ending in': apiKey.keyEnding,
        },
      },
    })

    await em.flush()

    return {
      status: 204,
    }
  },
})
