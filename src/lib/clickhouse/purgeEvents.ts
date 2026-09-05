import { ClickHouseClient } from '@clickhouse/client'
import { formatDateForClickHouse } from './formatDateTime.js'

export async function purgeEvents(
  clickhouse: ClickHouseClient,
  gameId: number,
  eventName: string,
  cutoff?: Date,
) {
  const cutoffClause = cutoff ? ' AND created_at < {cutoff:String}' : ''
  const params = {
    gameId,
    eventName,
    cutoff: cutoff ? formatDateForClickHouse(cutoff) : undefined,
  }

  let countQuery = `
    SELECT count() AS count FROM events
    WHERE game_id = {gameId:UInt32}
      AND name = {eventName:String}
  `
  countQuery += cutoffClause

  const [{ count }] = await clickhouse
    .query({ query: countQuery, query_params: params, format: 'JSONEachRow' })
    .then((res) => res.json<{ count: string }>())

  if (Number(count) === 0) {
    return 0
  }

  await clickhouse.command({
    query: `
      DELETE FROM event_props
      WHERE game_id = {gameId:UInt32}
        AND event_id IN (
          SELECT id FROM events
      WHERE game_id = {gameId:UInt32}
        AND name = {eventName:String}
      )${cutoffClause}
    `,
    query_params: params,
  })

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
