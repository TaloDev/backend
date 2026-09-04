import EventFunnel from '../../../entities/event-funnel.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { funnelSchema } from './common.js'

export const createRoute = protectedRoute({
  method: 'post',
  schema: () => ({
    body: funnelSchema,
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const body = ctx.state.validated.body
    const em = ctx.em

    const funnel = new EventFunnel(ctx.state.game)
    funnel.name = body.name
    funnel.steps = body.steps
    funnel.maxGap = body.maxGap

    await em.persist(funnel).flush()

    return {
      status: 200,
      body: {
        funnel,
      },
    }
  },
})
