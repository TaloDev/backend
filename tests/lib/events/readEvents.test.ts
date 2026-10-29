import { ClickHouseClient, ClickHouseError } from '@clickhouse/client'
import {
  CLICKHOUSE_QUERY_SETTINGS,
  QueryLimitError,
} from '../../../src/lib/clickhouse/runLimitedQuery.js'
import {
  capEventPage,
  decodeEventCursor,
  encodeEventCursor,
  MAX_PAGE_BYTES,
  RawEvent,
  readEventPage,
} from '../../../src/lib/events/readEvents.js'

const from = new Date('2026-01-01T00:00:00.000Z')
const to = new Date('2026-01-31T00:00:00.000Z')

function fakeClickhouse(query: ReturnType<typeof vi.fn>) {
  return { query } as unknown as ClickHouseClient
}

function readPage(clickhouse: ClickHouseClient) {
  return readEventPage({
    clickhouse,
    gameId: 1,
    from,
    to,
    includeDevData: false,
    includeProps: false,
    limit: 10,
  })
}

function base64(value: string) {
  return Buffer.from(value).toString('base64url')
}

describe('Event cursor', () => {
  it('should round-trip a cursor', () => {
    const cursor = { createdAt: '2026-01-01 00:00:00.000', id: 'abc-123' }
    expect(decodeEventCursor(encodeEventCursor(cursor))).toStrictEqual(cursor)
  })

  it('should reject malformed cursors', () => {
    expect(decodeEventCursor('not-a-cursor')).toBeNull()
    expect(decodeEventCursor(base64('{"id":1}'))).toBeNull()
    expect(decodeEventCursor(base64('["only-one"]'))).toBeNull()
    expect(decodeEventCursor(base64('[1,2]'))).toBeNull()
    expect(decodeEventCursor(base64('["2026-01-01 00:00:00.000",""]'))).toBeNull()
    expect(decodeEventCursor(base64('["not-a-date","abc"]'))).toBeNull()
  })
})

describe('readEventPage', () => {
  it('should run a query with the resource limits applied', async () => {
    const json = vi.fn().mockResolvedValue([])
    const query = vi.fn().mockResolvedValue({ json })

    await readPage(fakeClickhouse(query))

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        clickhouse_settings: CLICKHOUSE_QUERY_SETTINGS,
        format: 'JSONEachRow',
      }),
    )
  })

  it('should turn a resource limit breach into a clear error', async () => {
    const error = new ClickHouseError({
      message: 'Timeout exceeded: elapsed 30 seconds',
      code: '159',
      type: 'TIMEOUT_EXCEEDED',
    })
    const query = vi.fn().mockRejectedValue(error)

    await expect(readPage(fakeClickhouse(query))).rejects.toBeInstanceOf(QueryLimitError)
  })

  it('should pass through other ClickHouse errors untouched', async () => {
    const error = new ClickHouseError({
      message: 'Unknown table',
      code: '60',
      type: 'UNKNOWN_TABLE',
    })
    const query = vi.fn().mockRejectedValue(error)

    await expect(readPage(fakeClickhouse(query))).rejects.toBe(error)
  })
})

function buildEvent(id: string, propBytes: number): RawEvent {
  return {
    id,
    name: 'Level completed',
    playerAliasId: 1,
    devBuild: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    props: [{ key: 'data', value: 'x'.repeat(propBytes) }],
  }
}

function buildCursor(id: string) {
  return { createdAt: '2026-01-01 00:00:00.000', id }
}

describe('capEventPage', () => {
  it('should trim a page that would exceed the byte cap', () => {
    const events = Array.from({ length: 8 }, (_, idx) => buildEvent(`event-${idx}`, 1_000_000))
    const cursors = events.map((event) => buildCursor(event.id))

    const page = capEventPage(events, cursors, 8)

    expect(page.events.length).toBeGreaterThan(1)
    expect(page.events.length).toBeLessThan(events.length)
    expect(Buffer.byteLength(JSON.stringify(page.events))).toBeLessThanOrEqual(MAX_PAGE_BYTES)
    expect(page.nextCursor).not.toBeNull()
    expect(decodeEventCursor(page.nextCursor!)?.id).toBe(page.events.at(-1)!.id)
  })

  it('should always return at least one event, even when it alone breaks the cap', () => {
    const events = [buildEvent('huge', MAX_PAGE_BYTES)]
    const cursors = [buildCursor('huge')]

    const page = capEventPage(events, cursors, 8)

    expect(page.events).toHaveLength(1)
    // nothing was trimmed, so the caller is at the end of the feed
    expect(page.nextCursor).toBeNull()
  })

  it('should hand out a cursor only when the page is full', () => {
    const events = [buildEvent('a', 10), buildEvent('b', 10)]
    const cursors = events.map((event) => buildCursor(event.id))

    expect(capEventPage(events, cursors, 10).nextCursor).toBeNull()

    const fullPage = capEventPage(events, cursors, 2)
    expect(decodeEventCursor(fullPage.nextCursor!)?.id).toBe('b')
  })
})
