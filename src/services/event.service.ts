import { HasPermission, Service, Request, Response, Route, Validate } from 'koa-clay'
import EventPolicy from '../policies/event.policy'
import { endOfDay, startOfDay } from 'date-fns'
import dateValidationSchema from '../lib/dates/dateValidationSchema'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import { ClickHouseClient } from '@clickhouse/client'
import { millisecondsInDay } from 'date-fns/constants'
import assert from 'node:assert'

type EventData = {
  name: string
  date: number
  count: number
  change: number
}

type AggregatedClickHouseEvent = {
  name: string
  date: string
  count: string
}

type AggregatedClickHouseEventProps = {
  prop_key: string
  prop_value: string
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

function calculateChange(count: number, lastEvent: EventData | undefined): number {
  const previousCount = lastEvent?.count ?? 0

  if (previousCount === 0) {
    return count
  }

  return (count - previousCount) / previousCount
}

function fillDateGaps(
  data: Record<string, EventData[]>,
  startDateQuery: string,
  endDateQuery: string
): Record<string, EventData[]> {
  const startDateMs = startOfDay(new Date(startDateQuery)).getTime()
  const endDateMs = startOfDay(new Date(endDateQuery)).getTime()

  const result: Record<string, EventData[]> = {}

  for (const seriesName of Object.keys(data)) {
    const eventData = data[seriesName]
    assert(eventData)
    const filledData: EventData[] = []

    const eventsByDate = new Map<number, EventData>()
    for (const event of eventData) {
      eventsByDate.set(event.date, event)
    }

    // fill all dates in the range
    for (let currentDateMs = startDateMs; currentDateMs <= endDateMs; currentDateMs += millisecondsInDay) {
      const existingEvent = eventsByDate.get(currentDateMs)

      if (existingEvent) {
        filledData.push({ ...existingEvent, change: 0 })
      } else {
        filledData.push({
          name: seriesName,
          date: currentDateMs,
          count: 0,
          change: 0
        })
      }
    }

    for (let i = 0; i < filledData.length; i++) {
      const item = filledData[i]
      assert(item)
      const previousEvent = i > 0 ? filledData[i - 1] : undefined
      item.change = calculateChange(item.count, previousEvent)
    }

    result[seriesName] = filledData
  }

  return result
}

export default class EventService extends Service {
  @Route({
    method: 'GET'
  })
  @Validate({
    query: dateValidationSchema
  })
  @HasPermission(EventPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const { startDate: startDateQuery, endDate: endDateQuery } = req.query

    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    assert(startDateQuery)
    assert(endDateQuery)
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
      query += ' AND dev_build = false'
    }

    query += `
      GROUP BY name, date
      ORDER BY name, date
    `

    const events = await clickhouse.query({
      query,
      format: 'JSONEachRow'
    }).then((res) => res.json<AggregatedClickHouseEvent>())

    const data: Record<string, EventData[]> = {}
    for (const event of events) {
      if (!data[event.name]) {
        data[event.name] = []
      }

      data[event.name]?.push({
        name: event.name,
        date: Number(event.date),
        count: Number(event.count),
        change: 0 // will be calculated after filling gaps
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

  @Route({
    method: 'GET',
    path: '/breakdown'
  })
  @Validate({
    query: {
      eventName: {
        required: true
      },
      ...dateValidationSchema
    }
  })
  @HasPermission(EventPolicy, 'breakdown')
  async breakdown(req: Request): Promise<Response> {
    const { eventName, startDate: startDateQuery, endDate: endDateQuery } = req.query
    const clickhouse: ClickHouseClient = req.ctx.clickhouse

    assert(startDateQuery)
    assert(endDateQuery)
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
        AND events.game_id = ${req.ctx.state.game.id}
        AND NOT startsWith(event_props.prop_key, 'META_')
    `

    if (!req.ctx.state.includeDevData) {
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
        change: 0 // will be calculated after filling gaps
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
}
