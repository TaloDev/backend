import { ClickHouseClient } from '@clickhouse/client'
import { deleteEventPropsByIds } from './deleteEventProps.js'
import { forEachEventPage } from './eventCursor.js'
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
  const where =
    'game_id = {gameId:UInt32} AND name = {eventName:String} AND created_at < {cutoff:String}'
  const params = {
    gameId,
    eventName,
    cutoff: formatDateForClickHouse(cutoff),
  }

  const countQuery = `SELECT count() AS count FROM events WHERE ${where}`

  const [{ count }] = await clickhouse
    .query({ query: countQuery, query_params: params, format: 'JSONEachRow' })
    .then((res) => res.json<{ count: string }>())

  if (Number(count) === 0) {
    return 0
  }

  await forEachEventPage({
    clickhouse,
    where,
    params,
    pageSize,
    onPage: (rows) =>
      deleteEventPropsByIds({ clickhouse, gameId, eventIds: rows.map((row) => row.id) }),
  })

  await clickhouse.command({
    query: `DELETE FROM events WHERE ${where}`,
    query_params: params,
  })

  return Number(count)
}
