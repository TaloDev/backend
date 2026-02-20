import { endOfDay, startOfDay } from 'date-fns'
import { formatDateForClickHouse } from '../../../lib/clickhouse/formatDateTime'
import { withResponseCache } from '../../../lib/perf/responseCache'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { dateRangeSchema } from '../../../lib/validation/dateRangeSchema'
import { loadGame } from '../../../middleware/game-middleware'
import { HEADLINES_CACHE_TTL_MS } from './common'

export const averageSessionDurationRoute = protectedRoute({
  method: 'get',
  path: '/average_session_duration',
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
        key: `average-session-duration-${game.id}-${includeDevData}-${startDateQuery}-${endDateQuery}`,
        ttl: HEADLINES_CACHE_TTL_MS / 1000,
      },
      async () => {
        const startDate = formatDateForClickHouse(startOfDay(new Date(startDateQuery)))
        const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

        let query = `
        SELECT avg(dateDiff('seconds', started_at, ended_at)) AS averageDuration
        FROM player_sessions
        WHERE started_at BETWEEN '${startDate}' AND '${endDate}'
          AND ended_at IS NOT NULL
          AND game_id = ${game.id}
      `

        if (!includeDevData) {
          query += ' AND dev_build = false'
        }

        const result = await clickhouse
          .query({
            query,
            format: 'JSONEachRow',
          })
          .then((res) => res.json<{ averageDuration: number }>())

        const seconds = result[0].averageDuration

        return {
          status: 200,
          body: {
            hours: Math.floor(seconds / 3600),
            minutes: Math.floor((seconds % 3600) / 60),
            seconds: seconds % 60,
          },
        }
      },
    )
  },
})
