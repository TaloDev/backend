import { endOfDay } from 'date-fns'
import { formatDateForClickHouse } from '../../../lib/clickhouse/formatDateTime'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { dateRangeSchema } from '../../../lib/validation/dateRangeSchema'
import { loadGame } from '../../../middleware/game-middleware'
import { EventData, fillDateGaps } from './common'

type AggregatedClickHouseEvent = {
  name: string
  date: string
  count: string
}

export const listRoute = protectedRoute({
  method: 'get',
  schema: () => ({
    query: dateRangeSchema,
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { startDate: startDateQuery, endDate: endDateQuery } = ctx.state.validated.query
    const clickhouse = ctx.clickhouse

    const startDate = formatDateForClickHouse(new Date(startDateQuery))
    const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

    let query = `
      SELECT
        name,
        toUnixTimestamp(toStartOfDay(created_at)) * 1000 AS date,
        count() AS count
      FROM events
      WHERE created_at BETWEEN '${startDate}' AND '${endDate}'
        AND game_id = ${ctx.state.game.id}
    `

    if (!ctx.state.includeDevData) {
      query += ' AND dev_build = false'
    }

    query += `
      GROUP BY name, date
      ORDER BY name, date
    `

    const events = await clickhouse
      .query({
        query,
        format: 'JSONEachRow',
      })
      .then((res) => res.json<AggregatedClickHouseEvent>())

    const data: Record<string, EventData[]> = {}
    for (const event of events) {
      if (!data[event.name]) {
        data[event.name] = []
      }

      data[event.name].push({
        name: event.name,
        date: Number(event.date),
        count: Number(event.count),
        change: 0,
      })
    }

    const filledData = fillDateGaps(data, startDateQuery, endDateQuery)

    return {
      status: 200,
      body: {
        events: filledData,
        eventNames: Object.keys(filledData),
      },
    }
  },
})
