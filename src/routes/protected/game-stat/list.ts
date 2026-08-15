import type { ClickHouseClient } from '@clickhouse/client'
import type { EntityManager } from '@mikro-orm/mysql'
import type Game from '../../../entities/game.js'
import GameStat from '../../../entities/game-stat.js'
import { withResponseCache } from '../../../lib/perf/responseCache.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'

export async function listStatsHandler({
  em,
  game,
  includeDevData,
  clickhouse,
  withMetrics,
  metricsStartDate,
  metricsEndDate,
}: {
  em: EntityManager
  game: Game
  includeDevData: boolean
  clickhouse: ClickHouseClient
  withMetrics?: string
  metricsStartDate?: string
  metricsEndDate?: string
}) {
  return withResponseCache(
    {
      key: `${GameStat.getIndexCacheKey(game)}-${withMetrics}-${metricsStartDate}-${metricsEndDate}-${includeDevData ? 'dev' : 'no-dev'}`,
    },
    async () => {
      const stats = await em.repo(GameStat).find({ game })
      const globalStats = stats.filter((stat) => stat.global)

      if (globalStats.length > 0) {
        const promises = []

        if (withMetrics === '1') {
          promises.push(
            ...globalStats.map((stat) =>
              stat.loadMetrics({
                clickhouse,
                startDate: metricsStartDate,
                endDate: metricsEndDate,
                includeDevData,
              }),
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
}

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

    return listStatsHandler({
      em: ctx.em,
      game: ctx.state.game,
      includeDevData: ctx.state.includeDevData,
      clickhouse: ctx.clickhouse,
      withMetrics,
      metricsStartDate,
      metricsEndDate,
    })
  },
})
