import PlayerGameStatSnapshot from '../../../entities/player-game-stat-snapshot'
import { FlushMetricsQueueHandler, postFlushCheckMemberships } from './flush-metrics-queue-handler'
import { ClickHousePlayerGameStatSnapshot } from '../../../entities/player-game-stat-snapshot'

type SerialisedStatSnapshot = ClickHousePlayerGameStatSnapshot & { playerId: string }

export class FlushStatSnapshotsQueueHandler extends FlushMetricsQueueHandler<PlayerGameStatSnapshot, SerialisedStatSnapshot> {
  constructor() {
    super('stat-snapshots', async (clickhouse, values) => {
      await clickhouse.insert({
        table: 'player_game_stat_snapshots',
        values,
        format: 'JSONEachRow'
      })
    }, {
      postFlush: async (values) => {
        const playerIds = this.buildPlayerIdSet(values)

        if (playerIds.size > 0) {
          /* v8 ignore next 3 */
          if (process.env.NODE_ENV !== 'test') {
            console.info(`FlushStatSnapshotsQueueHandler checking groups for ${playerIds.size} players`)
          }
          await postFlushCheckMemberships(Array.from(playerIds))
        }
      }
    })
  }

  protected serialiseItem(snapshot: PlayerGameStatSnapshot) {
    return {
      ...snapshot.toInsertable(),
      playerId: snapshot.playerAlias.player.id
    }
  }

  buildPlayerIdSet(values: SerialisedStatSnapshot[]): Set<string> {
    return new Set(values.map((item) => item.playerId))
  }
}
