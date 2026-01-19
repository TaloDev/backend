import { endOfDay } from 'date-fns'
import { z } from 'zod'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { formatDateForClickHouse } from '../../../lib/clickhouse/formatDateTime'
import { dateRangeSchema } from '../../../lib/validation/dateRangeSchema'
import { EventData, fillDateGaps } from './common'

type AggregatedClickHouseEventProps = {
  prop_key: string
  prop_value: string
  date: string
  count: string
}

export const breakdownRoute = protectedRoute({
  method: 'get',
  path: '/breakdown',
  schema: () => ({
    query: dateRangeSchema.and(z.object({
      eventName: z.string()
    }))
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { eventName, startDate: startDateQuery, endDate: endDateQuery } = ctx.state.validated.query
    const clickhouse = ctx.clickhouse

    const startDate = formatDateForClickHouse(new Date(startDateQuery))
    const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

    let query = `
      SELECT
        prop_key,
        prop_value,
        toUnixTimestamp(toStartOfDay(events.created_at)) * 1000 AS date,
        count() AS count
      FROM event_props
      LEFT JOIN events ON events.id = event_props.event_id
      WHERE events.name = {eventName: String}
        AND events.created_at BETWEEN '${startDate}' AND '${endDate}'
        AND events.game_id = ${ctx.state.game.id}
        AND NOT startsWith(event_props.prop_key, 'META_')
    `

    if (!ctx.state.includeDevData) {
      query += ' AND dev_build = false'
    }

    query += `
      GROUP BY prop_key, prop_value, date
      ORDER BY prop_key, prop_value, date
    `

    const events = await clickhouse.query({
      query,
      query_params: {
        eventName
      },
      format: 'JSONEachRow'
    }).then((res) => res.json<AggregatedClickHouseEventProps>())

    const data: Record<string, EventData[]> = {}
    for (const event of events) {
      const keyValueLabel = `[${event.prop_key} = ${event.prop_value}]`
      if (!data[keyValueLabel]) {
        data[keyValueLabel] = []
      }

      data[keyValueLabel].push({
        name: keyValueLabel,
        date: Number(event.date),
        count: Number(event.count),
        change: 0
      })
    }

    const filledData = fillDateGaps(data, startDateQuery, endDateQuery)

    return {
      status: 200,
      body: {
        events: filledData,
        eventNames: Object.keys(filledData)
      }
    }
  }
})
