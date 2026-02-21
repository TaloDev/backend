import { endOfDay, startOfDay } from 'date-fns'
import { formatDateForClickHouse } from '../../../lib/clickhouse/formatDateTime'
import { withResponseCache } from '../../../lib/perf/responseCache'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { dateRangeSchema } from '../../../lib/validation/dateRangeSchema'
import { loadGame } from '../../../middleware/game-middleware'
import { HEADLINES_CACHE_TTL_MS } from './common'

export const eventsRoute = protectedRoute({
  method: 'get',
  path: '/events',
  schema: () => ({
    query: dateRangeSchema,
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { startDate: startDateQuery, endDate: endDateQuery } = ctx.state.validated.query
    const game = ctx.state.game
    const includeDevData = ctx.state.includeDevData
    const clickhouse = ctx.clickhouse

    return withResponseCache(
      {
        key: `events-${game.id}-${includeDevData}-${startDateQuery}-${endDateQuery}`,
        ttl: HEADLINES_CACHE_TTL_MS / 1000,
      },
      async () => {
        const startDate = formatDateForClickHouse(startOfDay(new Date(startDateQuery)))
        const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

        let query = `
        SELECT count() AS count
        FROM events
        WHERE created_at BETWEEN '${startDate}' AND '${endDate}'
          AND game_id = ${game.id}
      `

        if (!includeDevData) {
          query += 'AND dev_build = false'
        }

        const result = await clickhouse
          .query({
            query,
            format: 'JSONEachRow',
          })
          .then((res) => res.json<{ count: string }>())

        return {
          status: 200,
          body: {
            count: Number(result[0].count),
          },
        }
      },
    )
  },
})
