import createQueue from './createQueue'
import createClickHouseClient from '../clickhouse/createClient'
import { captureException } from '@sentry/node'

export type DeleteClickHousePlayerDataConfig = { playerIds: string[], aliasIds: number[] }

export function createDeleteClickHousePlayerDataQueue() {
  const queue = createQueue<DeleteClickHousePlayerDataConfig>('delete-clickhouse-player-data', async (job) => {
    const clickhouse = createClickHouseClient()
    try {
      const { aliasIds, playerIds } = job.data

      const queries: string[] = aliasIds.length > 0 ? [
        'DELETE FROM event_props WHERE event_id IN (SELECT id FROM events WHERE player_alias_id IN ({aliasIds:Array(UInt32)}))',
        'DELETE FROM events WHERE player_alias_id IN ({aliasIds:Array(UInt32)})',
        'DELETE FROM player_game_stat_snapshots WHERE player_alias_id IN ({aliasIds:Array(UInt32)})',
        'DELETE FROM player_sessions WHERE player_id IN ({playerIds:Array(String)})'
      ] : []

      await Promise.allSettled(queries.map((query) => {
        return clickhouse.exec({
          query,
          query_params: {
            aliasIds: aliasIds,
            playerIds: playerIds
          }
        })
      }))
    /* v8 ignore start */
    } catch (error) {
      captureException(error)
    /* v8 ignore stop */
    } finally {
      await clickhouse.close()
    }
  })

  return queue
}
