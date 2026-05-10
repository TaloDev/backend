import { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import { getTokenCacheKey } from '../../../lib/auth/getAPIKeyFromToken.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate, requireEmailConfirmed } from '../../../middleware/policy-middleware.js'
import { loadAPIKey, createToken } from './common.js'

export const revokeRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'revoke API keys'),
    requireEmailConfirmed('revoke API keys'),
    loadGame,
    loadAPIKey,
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const apiKey = ctx.state.apiKey

    apiKey.revokedAt = new Date()
    await em.clearCache(getTokenCacheKey(apiKey.id))

    const token = await createToken(em, apiKey)

    createGameActivity(em, {
      user: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.API_KEY_REVOKED,
      extra: {
        keyId: apiKey.id,
        display: {
          'Key ending in': token.substring(token.length - 5, token.length),
        },
      },
    })

    const socket = ctx.wss
    const conns = socket.findConnections((conn) => conn.getAPIKeyId() === apiKey.id)
    await Promise.all(conns.map((conn) => socket.closeConnection(conn.getSocket())))

    await em.flush()

    return {
      status: 204,
    }
  },
})
