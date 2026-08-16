import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { loadStat } from './common.js'
import { findDocs } from './docs.js'

export const findStatAdminRoute = adminRoute({
  method: 'get',
  path: '/:id',
  docs: findDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the stat' }),
    }),
    query: z.object({
      withMetrics: z
        .string()
        .optional()
        .meta({ description: 'Set to 1 to include metrics for global stats' }),
      metricsStartDate: z.string().optional().meta({
        description: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp',
      }),
      metricsEndDate: z.string().optional().meta({
        description: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp',
      }),
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
