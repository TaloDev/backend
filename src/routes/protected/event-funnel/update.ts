import EventFunnel from '../../../entities/event-funnel.js'
import updateAllowedKeys from '../../../lib/entities/updateAllowedKeys.js'
import { clearResponseCache } from '../../../lib/perf/responseCache.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { loadFunnel, updateFunnelSchema } from './common.js'

export const updateRoute = protectedRoute({
  method: 'patch',
  path: '/:id',
  schema: () => ({
    body: updateFunnelSchema,
  }),
  middleware: withMiddleware(loadGame, loadFunnel),
  handler: async (ctx) => {
    const body = ctx.state.validated.body
    const funnel = ctx.state.funnel

    updateAllowedKeys(funnel, body, ['name', 'steps', 'maxGap'])
    await ctx.em.flush()
    await clearResponseCache(`${EventFunnel.getCacheKey(ctx.state.game, funnel.id)}-*`)

    return {
      status: 200,
      body: {
        funnel,
      },
    }
  },
})
