import { GameActivityType } from '../../../entities/game-activity.js'
import GameVerificationKey from '../../../entities/game-verification-key.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadVerificationKey } from './common.js'

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'delete verification keys'),
    loadGame,
    loadVerificationKey,
  ),
  handler: async (ctx) => {
    const verificationKey = ctx.state.verificationKey
    const em = ctx.em

    createGameActivity(em, {
      user: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.VERIFICATION_KEY_DELETED,
      extra: {
        version: verificationKey.version,
      },
    })

    await em.remove(verificationKey).flush()
    await em.clearCache(GameVerificationKey.getCacheKey(ctx.state.game, verificationKey.version))

    return {
      status: 204,
    }
  },
})
