import { endOfDay, startOfDay } from 'date-fns'
import { millisecondsInDay } from 'date-fns/constants'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { formatDateForClickHouse } from '../../../lib/clickhouse/formatDateTime'
import { dateRangeSchema } from '../../../lib/validation/dateRangeSchema'
import GameStat from '../../../entities/game-stat'
import { calculateChange } from '../../../lib/math/calculateChange'
import { withResponseCache } from '../../../lib/perf/responseCache'

type StatGlobalValueData = {
  date: number
  value: number
  change: number
}

function fillDateGaps(
  data: Map<number, number>,
  startDateQuery: string,
  endDateQuery: string,
  defaultValue: number
): StatGlobalValueData[] {
  const startDateMs = startOfDay(new Date(startDateQuery)).getTime()
  const endDateMs = startOfDay(new Date(endDateQuery)).getTime()

  const result: StatGlobalValueData[] = []
  let prev = defaultValue

  for (let currentDateMs = startDateMs; currentDateMs <= endDateMs; currentDateMs += millisecondsInDay) {
    const value = data.get(currentDateMs) ?? prev
    const change = calculateChange(value, prev)
    result.push({ date: currentDateMs, value, change })
    prev = value
  }

  return result
}

type AggregatedClickHouseSnapshot = {
  date: string
  global_value: string
}

export const statsGlobalValueRoute = protectedRoute({
  method: 'get',
  path: '/global-stats/:internalName',
  schema: (z) => ({
    route: z.object({
      internalName: z.string()
    }),
    query: dateRangeSchema
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { internalName } = ctx.state.validated.route
    const { startDate: startDateQuery, endDate: endDateQuery } = ctx.state.validated.query
    const em = ctx.em
    const clickhouse = ctx.clickhouse

    const game = ctx.state.game

    const stat = await em.repo(GameStat).findOne({ game, internalName, global: true })
    if (!stat) {
      return ctx.throw(404, 'Stat not found')
    }

    return withResponseCache({
      key: `stats-global-value-${stat.id}-${startDateQuery}-${endDateQuery}`
    }, async () => {
      const startDate = formatDateForClickHouse(new Date(startDateQuery))
      const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

      const query = `
        SELECT
          toUnixTimestamp(toStartOfDay(created_at)) * 1000 AS date,
          max(global_value) AS global_value
        FROM player_game_stat_snapshots
        WHERE created_at BETWEEN {startDate:String} AND {endDate:String}
          AND game_stat_id = {statId:Int32}
        GROUP BY date
        ORDER BY date
      `

      const snapshots = await clickhouse.query({
        query,
        query_params: {
          startDate,
          endDate,
          statId: stat.id
        },
        format: 'JSONEachRow'
      }).then((res) => res.json<AggregatedClickHouseSnapshot>())

      const valuesMap = new Map<number, number>()
      for (const snapshot of snapshots) {
        valuesMap.set(Number(snapshot.date), Number(snapshot.global_value))
      }

      const data = fillDateGaps(valuesMap, startDateQuery, endDateQuery, stat.defaultValue)

      return {
        status: 200,
        body: {
          stat,
          data
        }
      }
    })
  }
})
