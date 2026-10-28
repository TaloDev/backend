import { ClickHouseClient } from '@clickhouse/client'
import { z } from 'zod'
import type { ClickHouseEvent } from '../../entities/event.js'
import type Prop from '../../entities/prop.js'
import { eventCursorClause } from '../clickhouse/eventCursor.js'
import { eventRangeParams, eventRangeWhere } from '../clickhouse/eventRange.js'
import { readEventProps } from '../clickhouse/readEventProps.js'
import { runLimitedQuery } from '../clickhouse/runLimitedQuery.js'
import { isValidDateString } from '../validation/dateRangeSchema.js'

// opaque keyset cursor over the (created_at, id) primary key order of `events`
type EventCursor = {
  createdAt: string
  id: string
}

export type RawEvent = {
  id: string
  name: string
  playerAliasId: number
  devBuild: boolean
  createdAt: string
  props?: Prop[]
}

type EventPage = {
  events: RawEvent[]
  nextCursor: string | null
}

// 2000 events with many props can serialise to tens of MB, which can
// easily bloat the response size and memory use.
export const MAX_PAGE_BYTES = 5 * 1024 * 1024

const cursorPayloadSchema = z.tuple([z.string().refine(isValidDateString), z.string().min(1)])

export function encodeEventCursor(cursor: EventCursor): string {
  return Buffer.from(JSON.stringify([cursor.createdAt, cursor.id])).toString('base64url')
}

export function decodeEventCursor(value: string): EventCursor | null {
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8')
    const parsed = cursorPayloadSchema.safeParse(JSON.parse(decoded))
    if (!parsed.success) {
      return null
    }

    const [createdAt, id] = parsed.data
    return { createdAt, id }
  } catch {
    return null
  }
}

// One page of the raw event feed, oldest first. Keyset paginated on
// (created_at, id) so a page never re-reads the rows before it.
export async function readEventPage({
  clickhouse,
  gameId,
  from,
  to,
  includeDevData,
  includeProps,
  limit,
  cursor,
}: {
  clickhouse: ClickHouseClient
  gameId: number
  from: Date
  to: Date
  includeDevData: boolean
  includeProps: boolean
  limit: number
  cursor?: EventCursor | null
}): Promise<EventPage> {
  const params = {
    ...eventRangeParams({ gameId, from, to }),
    limit,
    ...(cursor ? { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id } : {}),
  }

  let query = `
    SELECT id, name, game_id, player_alias_id, dev_build, created_at, updated_at
    FROM events
    WHERE ${eventRangeWhere(includeDevData)}
  `

  if (cursor) {
    query += ` AND ${eventCursorClause('{cursorCreatedAt:DateTime64(3)}', '{cursorId:String}')}`
  }

  query += `
    ORDER BY created_at ASC, id ASC
    LIMIT {limit:UInt32}
  `

  const rows = await runLimitedQuery<ClickHouseEvent>({ clickhouse, query, params })

  const propsByEventId = includeProps
    ? await readEventProps({ clickhouse, events: rows })
    : new Map<string, Prop[]>()

  const events = rows.map((row) =>
    toRawEvent(row, includeProps ? (propsByEventId.get(row.id) ?? []) : undefined),
  )
  const cursors = rows.map((row) => ({ createdAt: row.created_at, id: row.id }))

  return capEventPage(events, cursors, limit)
}

function toRawEvent(row: ClickHouseEvent, props?: Prop[]): RawEvent {
  const event: RawEvent = {
    id: row.id,
    name: row.name,
    playerAliasId: Number(row.player_alias_id),
    devBuild: Boolean(row.dev_build),
    createdAt: new Date(row.created_at).toISOString(),
  }

  if (props) {
    event.props = props
  }

  return event
}

// Trim a page down to the byte cap. `cursors[i]` is the keyset position of
// `events[i]`; the returned cursor points at the last event we actually kept.
export function capEventPage(events: RawEvent[], cursors: EventCursor[], limit: number): EventPage {
  const included: RawEvent[] = []
  let bytes = 0
  let truncated = false

  for (const event of events) {
    // + 1 for the separating comma, close enough for a soft cap
    const size = Buffer.byteLength(JSON.stringify(event)) + 1

    // always include the first event, otherwise the cursor can't advance
    if (included.length > 0 && bytes + size > MAX_PAGE_BYTES) {
      truncated = true
      break
    }

    included.push(event)
    bytes += size
  }

  // fewer rows than the limit (with nothing dropped) means there are no more rows.
  // otherwise the next page starts after the last row we kept.
  const isLastPage = !truncated && events.length < limit
  const lastCursor = cursors[included.length - 1]
  const hasMore = !isLastPage && Boolean(lastCursor)
  const nextCursor = hasMore ? encodeEventCursor(lastCursor) : null

  return {
    events: included,
    nextCursor,
  }
}
