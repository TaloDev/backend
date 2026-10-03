import { captureException } from '@sentry/node'
import createClickHouseClient from '../clickhouse/createClient.js'
import { deleteEventPropsWhere } from '../clickhouse/deleteEventProps.js'
import createQueue from './createQueue.js'

export type DeleteClickHousePlayerDataConfig = {
  gameId: number
  playerIds: string[]
  aliasIds: number[]
}

export function createDeleteClickHousePlayerDataQueue() {
  const queue = createQueue<DeleteClickHousePlayerDataConfig>(
    'delete-clickhouse-player-data',
    async (job) => {
      const clickhouse = createClickHouseClient()
      try {
        const { gameId, aliasIds, playerIds } = job.data

        if (aliasIds.length === 0) {
          return
        }

        await deleteEventPropsWhere({
          clickhouse,
          gameId,
          where: 'player_alias_id IN {aliasIds:Array(UInt32)}',
          params: { aliasIds },
        })

        await Promise.all(
          [
            {
              query:
                'DELETE FROM events WHERE game_id = {gameId:UInt32} AND player_alias_id IN {aliasIds:Array(UInt32)}',
              query_params: { gameId, aliasIds },
            },
            {
              query:
                'DELETE FROM player_game_stat_snapshots WHERE player_alias_id IN {aliasIds:Array(UInt32)}',
              query_params: { aliasIds },
            },
            {
              query: 'DELETE FROM player_sessions WHERE player_id IN {playerIds:Array(String)}',
              query_params: { playerIds },
            },
          ].map((params) => clickhouse.command(params)),
        )
        /* v8 ignore start -- @preserve */
      } catch (error) {
        captureException(error)
        throw error
        /* v8 ignore stop -- @preserve */
      } finally {
        await clickhouse.close()
      }
    },
  )

  return queue
}
