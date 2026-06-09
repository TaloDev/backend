import GameVerificationKey from '../../../entities/game-verification-key.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'

export const listRoute = protectedRoute({
  method: 'get',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const verificationKeys = await ctx.em.repo(GameVerificationKey).find(
      {
        game: ctx.state.game,
      },
      {
        orderBy: { createdAt: 'DESC' },
      },
    )

    await ctx.em.populate(ctx.state.game, ['apiSecret'])

    return {
      status: 200,
      body: {
        verificationKeys,
      },
    }
  },
})
