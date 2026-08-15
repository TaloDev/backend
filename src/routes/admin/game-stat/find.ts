import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { loadStat } from './common.js'

export const findStatAdminRoute = adminRoute({
  method: 'get',
  path: '/:id',
  schema: (z) => ({
    query: z.object({
      withMetrics: z.string().optional(),
      metricsStartDate: z.string().optional(),
      metricsEndDate: z.string().optional(),
    }),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.READ_STATS]), loadStat),
  handler: async (ctx) => {
    const { withMetrics, metricsStartDate, metricsEndDate } = ctx.state.validated.query
    const em = ctx.em
    const stat = ctx.state.stat
    const includeDevData = ctx.state.includeDevData

    if (stat.global) {
      if (withMetrics === '1') {
        await stat.loadMetrics({
          clickhouse: ctx.clickhouse,
          startDate: metricsStartDate,
          endDate: metricsEndDate,
          includeDevData,
        })
      }

      if (!includeDevData) {
        await stat.recalculateGlobalValue({ em, includeDevData: false })
      }
    }

    return {
      status: 200,
      body: {
        stat,
      },
    }
  },
})
