import EventFunnel from '../../../entities/event-funnel.js'
import { clearResponseCache } from '../../../lib/perf/responseCache.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { loadFunnel } from './common.js'

export const refreshRoute = protectedRoute({
  method: 'delete',
  path: '/:id/refresh',
  middleware: withMiddleware(loadGame, loadFunnel),
  handler: async (ctx) => {
    await clearResponseCache(`${EventFunnel.getCacheKey(ctx.state.game, ctx.state.funnel.id)}-*`)

    return {
      status: 204,
    }
  },
})
