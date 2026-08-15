import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { listStatsHandler } from '../../protected/game-stat/list.js'

export const listStatsAdminRoute = adminRoute({
  method: 'get',
  schema: (z) => ({
    query: z.object({
      withMetrics: z.string().optional(),
      metricsStartDate: z.string().optional(),
      metricsEndDate: z.string().optional(),
    }),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.READ_STATS])),
  handler: (ctx) => {
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
