import { withResponseCache } from '../../../lib/perf/responseCache.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { dateRangeSchema } from '../../../lib/validation/dateRangeSchema.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { computeFunnel, FUNNEL_CACHE_TTL, loadFunnel } from './common.js'

export const getRoute = protectedRoute({
  method: 'get',
  path: '/:id',
  schema: () => ({
    query: dateRangeSchema,
  }),
  middleware: withMiddleware(loadGame, loadFunnel),
  handler: async (ctx) => {
    const { startDate, endDate } = ctx.state.validated.query
    const funnel = ctx.state.funnel

    const game = ctx.state.game
    const includeDevData = ctx.state.includeDevData

    return withResponseCache(
      {
        key: `event-funnel-${game.id}-${funnel.id}-${startDate}-${endDate}-${includeDevData ? 'dev' : 'no-dev'}`,
        ttl: FUNNEL_CACHE_TTL,
      },
      async () => {
        const result = await computeFunnel({
          clickhouse: ctx.clickhouse,
          game,
          includeDevData,
          steps: funnel.steps,
          maxGap: funnel.maxGap,
          startDate,
          endDate,
        })

        return {
          status: 200,
          body: {
            funnel,
            result: {
              steps: result,
              lastUpdatedAt: Date.now(),
            },
          },
        }
      },
    )
  },
})
