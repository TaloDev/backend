import { ClickHouseClient } from '@clickhouse/client'
import Prop from '../../entities/prop.js'
import { formatDateForClickHouse } from './formatDateTime.js'
import { runLimitedQuery } from './runLimitedQuery.js'

type EventPropRow = {
  event_id: string
  prop_key: string
  prop_value: string
}

type EventForProps = {
  id: string
  game_id: number
  created_at: string
}

// Props share their event's created_at, so bound the scan to the page's time
// range and id set instead of reading every prop for the game.
export async function readEventProps({
  clickhouse,
  events,
}: {
  clickhouse: ClickHouseClient
  events: EventForProps[]
}): Promise<Map<string, Prop[]>> {
  if (events.length === 0) {
    return new Map()
  }

  const times = events.map((event) => new Date(event.created_at).getTime())

  const rows = await runLimitedQuery<EventPropRow>({
    clickhouse,
    query: `
      SELECT event_id, prop_key, prop_value
      FROM event_props
      WHERE game_id IN {gameIds:Array(UInt32)}
        AND created_at >= {start:DateTime64(3)}
        AND created_at <= {end:DateTime64(3)}
        AND event_id IN {eventIds:Array(String)}
    `,
    params: {
      gameIds: Array.from(new Set(events.map((event) => event.game_id))),
      start: formatDateForClickHouse(new Date(Math.min(...times))),
      end: formatDateForClickHouse(new Date(Math.max(...times))),
      eventIds: events.map((event) => event.id),
    },
  })

  const propsByEventId = new Map<string, Prop[]>()
  for (const row of rows) {
    const eventProps = propsByEventId.get(row.event_id) ?? []
    eventProps.push(new Prop(row.prop_key, row.prop_value))
    propsByEventId.set(row.event_id, eventProps)
  }

  return propsByEventId
}
