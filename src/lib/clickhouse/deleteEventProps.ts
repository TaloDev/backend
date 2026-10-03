import { ClickHouseClient } from '@clickhouse/client'
import { forEachEventPage } from './eventCursor.js'

const IDS_PER_QUERY = 2_000

export async function deleteEventPropsByIds({
  clickhouse,
  gameId,
  eventIds,
  chunkSize = IDS_PER_QUERY,
}: {
  clickhouse: ClickHouseClient
  gameId: number
  eventIds: string[]
  chunkSize?: number
}) {
  for (let i = 0; i < eventIds.length; i += chunkSize) {
    await clickhouse.command({
      query:
        'DELETE FROM event_props WHERE game_id = {gameId:UInt32} AND event_id IN {eventIds:Array(String)}',
      query_params: { gameId, eventIds: eventIds.slice(i, i + chunkSize) },
    })
  }
}

export async function deleteEventPropsWhere({
  clickhouse,
  gameId,
  where,
  params,
  pageSize = IDS_PER_QUERY,
}: {
  clickhouse: ClickHouseClient
  gameId: number
  where: string
  params: Record<string, unknown>
  pageSize?: number
}) {
  await forEachEventPage({
    clickhouse,
    where: `game_id = {gameId:UInt32} AND ${where}`,
    params: { ...params, gameId },
    pageSize,
    onPage: (rows) =>
      deleteEventPropsByIds({ clickhouse, gameId, eventIds: rows.map((row) => row.id) }),
  })
}
