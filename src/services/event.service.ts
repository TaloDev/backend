import { HasPermission, Service, Request, Response, Validate } from 'koa-clay'
import EventPolicy from '../policies/event.policy'
import { endOfDay } from 'date-fns'
import dateValidationSchema from '../lib/dates/dateValidationSchema'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import { ClickHouseClient } from '@clickhouse/client'

type EventData = {
  name: string
  date: number
  count: number
  change: number
}

type AggregatedClickhouseEvent = {
  name: string
  date: string
  count: string
}

// events: {
//   'Zone explored': [
//     { name: 'Zone explored', date: 1577836800000, count: 3 },
//     { name: 'Zone explored', date: 1577923200000, count: 1 }
//   ],
//   'Loot item': [
//     { name: 'Loot item', date: '1577923200000, count: 2 }
//   ]
// }

export default class EventService extends Service {
  @Validate({
    query: dateValidationSchema
  })
  @HasPermission(EventPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const { startDate: startDateQuery, endDate: endDateQuery } = req.query

    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    const startDate = formatDateForClickHouse(new Date(startDateQuery))
    const endDate = formatDateForClickHouse(endOfDay(new Date(endDateQuery)))

    let query = `
      SELECT
        name,
        toUnixTimestamp(toStartOfDay(created_at)) * 1000 AS date,
        count() AS count
      FROM events
      WHERE created_at BETWEEN '${startDate}' AND '${endDate}'
        AND game_id = ${req.ctx.state.game.id}
    `

    if (!req.ctx.state.includeDevData) {
      query += 'AND dev_build = false'
    }

    query += `
      GROUP BY name, date
      ORDER BY name, date
    `

    const events = await clickhouse.query({
      query,
      format: 'JSONEachRow'
    }).then((res) => res.json<AggregatedClickhouseEvent>())

    const data: Record<string, EventData[]> = {}
    for (const event of events) {
      if (!data[event.name]) {
        data[event.name] = []
      }

      const lastEvent = data[event.name].at(-1)
      const change = this.calculateChange(Number(event.count), lastEvent)

      data[event.name].push({
        name: event.name,
        date: Number(event.date),
        count: Number(event.count),
        change
      })
    }

    return {
      status: 200,
      body: {
        events: data,
        eventNames: Object.keys(data)
      }
    }
  }

  private calculateChange(count: number, lastEvent: EventData | undefined): number {
    if ((lastEvent?.count ?? 0) === 0) return count || 1

    return (count - lastEvent.count) / lastEvent.count
  }
}
