import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { computeFunnel, previewSchema } from './common.js'

export const previewRoute = protectedRoute({
  method: 'post',
  path: '/preview',
  schema: () => ({
    body: previewSchema,
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { steps, maxGap, startDate, endDate } = ctx.state.validated.body

    const result = await computeFunnel({
      clickhouse: ctx.clickhouse,
      game: ctx.state.game,
      includeDevData: ctx.state.includeDevData,
      steps,
      maxGap,
      startDate,
      endDate,
    })

    return {
      status: 200,
      body: {
        result: {
          steps: result,
          lastUpdatedAt: Date.now(),
        },
      },
    }
  },
})
