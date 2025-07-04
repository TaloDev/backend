import PlayerGameStatSnapshot from '../../../entities/player-game-stat-snapshot'
import { FlushMetricsQueueHandler } from './flush-metrics-queue-handler'

export class FlushStatSnapshotsQueueHandler extends FlushMetricsQueueHandler<PlayerGameStatSnapshot> {
  constructor() {
    super('stat-snapshots', async (clickhouse, values) => {
      await clickhouse.insert({
        table: 'player_game_stat_snapshots',
        values: values.map((snapshot) => snapshot.toInsertable()),
        format: 'JSONEachRow'
      })
    })
  }
}
