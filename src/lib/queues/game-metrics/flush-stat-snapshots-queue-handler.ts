import PlayerGameStatSnapshot from '../../../entities/player-game-stat-snapshot'
import { FlushMetricsQueueHandler, postFlushCheckMemberships } from './flush-metrics-queue-handler'
import Player from '../../../entities/player'

export class FlushStatSnapshotsQueueHandler extends FlushMetricsQueueHandler<PlayerGameStatSnapshot> {
  constructor() {
    super('stat-snapshots', async (clickhouse, values) => {
      await clickhouse.insert({
        table: 'player_game_stat_snapshots',
        values: values.map((snapshot) => snapshot.toInsertable()),
        format: 'JSONEachRow'
      })
    }, {
      postFlush: async (values) => {
        const playerSet = this.buildPlayerSet(values)

        if (playerSet.size > 0) {
          /* v8 ignore next 3 */
          if (process.env.NODE_ENV !== 'test') {
            console.info(`FlushStatSnapshotsQueueHandler checking groups for ${playerSet.size} players`)
          }
          await postFlushCheckMemberships(Array.from(playerSet))
        }
      }
    })
  }

  buildPlayerSet(values: PlayerGameStatSnapshot[]) {
    const playerMap = new Map<string, Player>()
    for (const snapshot of values) {
      playerMap.set(snapshot.playerAlias.player.id, snapshot.playerAlias.player)
    }
    return new Set(playerMap.values())
  }
}
