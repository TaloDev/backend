import { ClickHouseClient } from '@clickhouse/client'

const IDS_PER_QUERY = 2_000

export async function deleteEventPropsByIds({
  clickhouse,
  eventIds,
  chunkSize = IDS_PER_QUERY,
}: {
  clickhouse: ClickHouseClient
  eventIds: string[]
  chunkSize?: number
}) {
  for (let i = 0; i < eventIds.length; i += chunkSize) {
    await clickhouse.command({
      query: 'DELETE FROM event_props WHERE event_id IN {eventIds:Array(String)}',
      query_params: { eventIds: eventIds.slice(i, i + chunkSize) },
    })
  }
}

export async function deleteEventPropsWhere({
  clickhouse,
  where,
  params,
  pageSize = IDS_PER_QUERY,
}: {
  clickhouse: ClickHouseClient
  where: string
  params: Record<string, unknown>
  pageSize?: number
}) {
  let lastId = ''
  let hasMore = true

  while (hasMore) {
    const cursorClause = lastId ? 'AND id > {lastId:String} ' : ''
    const rows = await clickhouse
      .query({
        query: `SELECT id FROM events WHERE ${where} ${cursorClause}ORDER BY id LIMIT ${pageSize}`,
        query_params: { ...params, lastId },
        format: 'JSONEachRow',
      })
      .then((res) => res.json<{ id: string }>())

    await deleteEventPropsByIds({ clickhouse, eventIds: rows.map((row) => row.id) })

    hasMore = rows.length === pageSize
    lastId = rows.at(-1)?.id ?? lastId
  }
}
