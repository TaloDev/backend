import { ClickHouseClient } from '@clickhouse/client'

export type EventCursorRow = {
  id: string
  created_at: string
}

// Compare created_at and id separately so ClickHouse can use the
// (game_id, created_at, id) primary key
export function eventCursorClause(createdAtSql: string, idSql: string): string {
  return `(created_at > ${createdAtSql} OR (created_at = ${createdAtSql} AND id > ${idSql}))`
}

// Step through events in primary key order, one page at a time
export async function forEachEventPage({
  clickhouse,
  where,
  params,
  pageSize,
  onPage,
}: {
  clickhouse: ClickHouseClient
  where: string
  params: Record<string, unknown>
  pageSize: number
  onPage: (rows: EventCursorRow[]) => Promise<void>
}) {
  let lastCreatedAt = ''
  let lastId = ''

  while (true) {
    // resume after the previous page's (created_at, id)
    const cursorClause =
      lastCreatedAt && lastId
        ? `AND ${eventCursorClause('{lastCreatedAt:DateTime64(3)}', '{lastId:String}')} `
        : ''

    const rows = await clickhouse
      .query({
        query: `SELECT id, created_at FROM events WHERE ${where} ${cursorClause}ORDER BY created_at ASC, id ASC LIMIT ${pageSize}`,
        query_params: { ...params, lastCreatedAt, lastId },
        format: 'JSONEachRow',
      })
      .then((res) => res.json<EventCursorRow>())

    await onPage(rows)

    if (rows.length < pageSize) {
      return
    }

    lastCreatedAt = rows.at(-1)!.created_at
    lastId = rows.at(-1)!.id
  }
}
