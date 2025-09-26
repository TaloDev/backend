import createQueue from './createQueue'
import createClickHouseClient from '../clickhouse/createClient'
import { captureException } from '@sentry/node'

export type DeleteClickHousePlayerDataConfig = { playerIds: string[], aliasIds: number[], deleteSessions?: boolean }

export function createDeleteClickHousePlayerDataQueue() {
  const queue = createQueue<DeleteClickHousePlayerDataConfig>('delete-clickhouse-player-data', async (job) => {
    const clickhouse = createClickHouseClient()
    try {
      const { playerIds, aliasIds, deleteSessions } = job.data
      const aliasList = aliasIds.join(', ')
      const playerList = playerIds.map((id) => `'${id}'`).join(',')

      const queries: string[] = aliasList.length > 0 ? [
        `DELETE FROM event_props WHERE event_id IN (SELECT id FROM events WHERE player_alias_id IN (${aliasList}))`,
        `DELETE FROM events WHERE player_alias_id IN (${aliasList})`,
        `DELETE FROM socket_events WHERE player_alias_id IN (${aliasList})`,
        `DELETE FROM player_game_stat_snapshots WHERE player_alias_id IN (${aliasList})`
      ] : []

      if (deleteSessions) {
        queries.push(`DELETE FROM player_sessions WHERE player_id in (${playerList})`)
      }

      await Promise.allSettled(queries.map((query) => clickhouse.exec({ query })))
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
