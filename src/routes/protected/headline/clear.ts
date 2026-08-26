import { clearResponseCache } from '../../../lib/perf/responseCache.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'

export const clearHeadlinesRoute = protectedRoute({
  method: 'delete',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const game = ctx.state.game

    await clearResponseCache(`headline-${game.id}-*`)

    return {
      status: 200,
      body: {},
    }
  },
})
