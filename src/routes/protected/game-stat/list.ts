import GameStat from '../../../entities/game-stat'
import { withResponseCache } from '../../../lib/perf/responseCache'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'

export const listRoute = protectedRoute({
  method: 'get',
  schema: (z) => ({
    query: z.object({
      withMetrics: z.string().optional(),
      metricsStartDate: z.string().optional(),
      metricsEndDate: z.string().optional(),
    }),
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { withMetrics, metricsStartDate, metricsEndDate } = ctx.state.validated.query
    const em = ctx.em
    const game = ctx.state.game
    const includeDevData = ctx.state.includeDevData

    return withResponseCache(
      {
        key: `${GameStat.getIndexCacheKey(game)}-${withMetrics}-${metricsStartDate}-${metricsEndDate}-${includeDevData ? 'dev' : 'live'}`,
      },
      async () => {
        const stats = await em.repo(GameStat).find({ game })
        const globalStats = stats.filter((stat) => stat.global)

        if (globalStats.length > 0) {
          const promises = []

          if (withMetrics === '1') {
            promises.push(
              ...globalStats.map((stat) =>
                stat.loadMetrics(ctx.clickhouse, metricsStartDate, metricsEndDate),
              ),
            )
          }

          if (!includeDevData) {
            promises.push(
              ...globalStats.map((stat) =>
                stat.recalculateGlobalValue({ em, includeDevData: false }),
              ),
            )
          }

          await Promise.allSettled(promises)
        }

        return {
          status: 200,
          body: {
            stats,
          },
        }
      },
    )
  },
})
