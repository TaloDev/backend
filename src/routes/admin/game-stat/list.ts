import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { listStatsHandler } from '../../protected/game-stat/list.js'
import { listDocs } from './docs.js'

export const listStatsAdminRoute = adminRoute({
  method: 'get',
  docs: listDocs,
  schema: (z) => ({
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
