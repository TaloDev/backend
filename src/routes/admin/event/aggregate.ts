import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { aggregateEventCounts } from '../../../lib/events/aggregateEvents.js'
import { withResponseCache } from '../../../lib/perf/responseCache.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { aggregateEventsQuerySchema } from './common.js'
import { aggregateDocs } from './docs.js'

const AGGREGATE_CACHE_TTL_SECONDS = 60

export const aggregateEventsAdminRoute = adminRoute({
  method: 'get',
  path: '/aggregate',
  docs: aggregateDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-include-dev-data': z
        .string()
        .optional()
        .meta({ description: 'Set to 1 to include dev build events' }),
    }),
    query: aggregateEventsQuerySchema,
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.READ_EVENTS])),
  handler: async (ctx) => {
    const { from, to, interval, name } = ctx.state.validated.query
    const names = name ? [...new Set(name)] : undefined

    const cacheKey = JSON.stringify([
      'admin-events-aggregate',
      ctx.state.game.id,
      new Date(from).getTime(),
      new Date(to).getTime(),
      interval,
      names ?? null,
      ctx.state.includeDevData,
    ])

    return withResponseCache({ key: cacheKey, ttl: AGGREGATE_CACHE_TTL_SECONDS }, async () => ({
      status: 200,
      body: {
        series: await aggregateEventCounts({
          clickhouse: ctx.clickhouse,
          gameId: ctx.state.game.id,
          from: new Date(from),
          to: new Date(to),
          interval,
          names,
          includeDevData: ctx.state.includeDevData,
        }),
      },
    }))
  },
})
