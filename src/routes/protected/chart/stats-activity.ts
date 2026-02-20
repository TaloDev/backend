import { endOfDay, startOfDay } from 'date-fns'
import { millisecondsInDay } from 'date-fns/constants'
import assert from 'node:assert'
import GameStat from '../../../entities/game-stat'
import { formatDateForClickHouse } from '../../../lib/clickhouse/formatDateTime'
import { calculateChange } from '../../../lib/math/calculateChange'
import { withResponseCache } from '../../../lib/perf/responseCache'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { dateRangeSchema } from '../../../lib/validation/dateRangeSchema'
import { loadGame } from '../../../middleware/game-middleware'

type StatValues = {
  [key: string]: number
}

type StatCountData = {
  date: number
  stats: StatValues
  change: StatValues
}

function buildDataWithChanges(
  data: Map<number, StatValues>,
  startDateQuery: string,
  endDateQuery: string,
  statNames: string[],
): StatCountData[] {
  const startDateMs = startOfDay(new Date(startDateQuery)).getTime()
  const endDateMs = startOfDay(new Date(endDateQuery)).getTime()

  const result: StatCountData[] = []
  let prev: StatValues = {}

  for (
    let currentDateMs = startDateMs;
    currentDateMs <= endDateMs;
    currentDateMs += millisecondsInDay
  ) {
    const stats = data.get(currentDateMs) ?? {}
    const change: StatValues = {}

    for (const name of statNames) {
      change[name] = calculateChange(stats[name] ?? 0, prev[name] ?? 0)
    }

    result.push({ date: currentDateMs, stats, change })
    prev = stats
  }

  return result
}

type AggregatedClickHouseSnapshot = {
  game_stat_id: string
  date: string
  count: string
}

export const statsActivityRoute = protectedRoute({
  method: 'get',
  path: '/stats-activity',
  schema: () => ({
    query: dateRangeSchema,
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { startDate: startDateQuery, endDate: endDateQuery } = ctx.state.validated.query
    const em = ctx.em
    const clickhouse = ctx.clickhouse

    const game = ctx.state.game

    return withResponseCache(
      {
        key: `stats-activity-${game.id}-${startDateQuery}-${endDateQuery}`,
      },
      async () => {
        const startDate = formatDateForClickHouse(new Date(startDateQuery))
        const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))
        const gameStats = await em.repo(GameStat).find({ game })

        const statIdToName = new Map<number, string>()
        for (const stat of gameStats) {
          statIdToName.set(stat.id, stat.name)
        }

        const statIds = gameStats.map((stat) => stat.id)
        if (statIds.length === 0) {
          return {
            status: 200,
            body: {
              data: [] as StatCountData[],
              statNames: [] as string[],
            },
          }
        }

        const query = `
        SELECT
          game_stat_id,
          toUnixTimestamp(toStartOfDay(created_at)) * 1000 AS date,
          count() AS count
        FROM player_game_stat_snapshots
        WHERE created_at BETWEEN {startDate:String} AND {endDate:String}
          AND game_stat_id IN ({statIds:Array(Int32)})
        GROUP BY game_stat_id, date
        ORDER BY game_stat_id, date
      `

        const snapshots = await clickhouse
          .query({
            query,
            query_params: {
              startDate,
              endDate,
              statIds,
            },
            format: 'JSONEachRow',
          })
          .then((res) => res.json<AggregatedClickHouseSnapshot>())

        const statsMap = new Map<number, StatValues>()
        for (const snapshot of snapshots) {
          const statName = statIdToName.get(Number(snapshot.game_stat_id))
          assert(statName)

          const date = Number(snapshot.date)
          const existing = statsMap.get(date) ?? {}
          statsMap.set(date, {
            ...existing,
            [statName]: Number(snapshot.count),
          })
        }

        const statNames = Array.from(statIdToName.values())
        const data = buildDataWithChanges(statsMap, startDateQuery, endDateQuery, statNames)

        return {
          status: 200,
          body: {
            data,
            statNames,
          },
        }
      },
    )
  },
})
