import EventFunnel from '../../../entities/event-funnel.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'

export const listRoute = protectedRoute({
  method: 'get',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const funnels = await ctx.em
      .repo(EventFunnel)
      .find({ game: ctx.state.game }, { orderBy: { createdAt: 'desc' } })

    return {
      status: 200,
      body: {
        funnels,
      },
    }
  },
})
