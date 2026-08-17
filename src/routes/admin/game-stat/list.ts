import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { listStatsQuerySchema } from '../../../lib/validation/routes/game-stats/listStatsQuerySchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { listStatsHandler } from '../../protected/game-stat/list.js'
import { listDocs } from './docs.js'

export const listStatsAdminRoute = adminRoute({
  method: 'get',
  docs: listDocs,
  schema: () => ({
    query: listStatsQuerySchema,
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
