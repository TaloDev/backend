import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { loadFunnel } from './common.js'

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(loadGame, loadFunnel),
  handler: async (ctx) => {
    const funnel = ctx.state.funnel

    await ctx.em.remove(funnel).flush()

    return {
      status: 204,
    }
  },
})
