import { ClickHouseClient } from '@clickhouse/client'
import { deleteEventPropsByIds } from './deleteEventProps.js'
import { formatDateForClickHouse } from './formatDateTime.js'

const PAGE_SIZE = 2_000

export async function purgeEvents({
  clickhouse,
  gameId,
  eventName,
  cutoff = new Date(),
  pageSize = PAGE_SIZE,
}: {
  clickhouse: ClickHouseClient
  gameId: number
  eventName: string
  cutoff?: Date
  pageSize?: number
}) {
  const cutoffClause = ' AND created_at < {cutoff:String}'
  const params = {
    gameId,
    eventName,
    cutoff: formatDateForClickHouse(cutoff),
  }

  const countQuery = `
    SELECT count() AS count FROM events
    WHERE game_id = {gameId:UInt32}
      AND name = {eventName:String}${cutoffClause}
  `

  const [{ count }] = await clickhouse
    .query({ query: countQuery, query_params: params, format: 'JSONEachRow' })
    .then((res) => res.json<{ count: string }>())

  if (Number(count) === 0) {
    return 0
  }

  let lastCreatedAt = ''
  let lastId = ''
  let hasMore = true

  while (hasMore) {
    const cursorClause =
      lastCreatedAt && lastId
        ? ' AND (created_at, id) > ({lastCreatedAt:String}, {lastId:String})'
        : ''

    const rows = await clickhouse
      .query({
        query: `
          SELECT id, created_at FROM events
          WHERE game_id = {gameId:UInt32}
            AND name = {eventName:String}${cutoffClause}${cursorClause}
          ORDER BY created_at, id
          LIMIT ${pageSize}
        `,
        query_params: { ...params, lastCreatedAt, lastId },
        format: 'JSONEachRow',
      })
      .then((res) => res.json<{ id: string; created_at: string }>())

    await deleteEventPropsByIds({ clickhouse, eventIds: rows.map((row) => row.id) })

    hasMore = rows.length === pageSize
    lastCreatedAt = rows.at(-1)?.created_at ?? lastCreatedAt
    lastId = rows.at(-1)?.id ?? lastId
  }

  await clickhouse.command({
    query: `
      DELETE FROM events
      WHERE game_id = {gameId:UInt32}
        AND name = {eventName:String}${cutoffClause}
    `,
    query_params: params,
  })

  return Number(count)
}
