import PlayerGameStatSnapshot from '../../../entities/player-game-stat-snapshot'
import { FlushMetricsQueueHandler } from './flush-metrics-queue-handler'
import { getMikroORM } from '../../../config/mikro-orm.config'
import { checkGroupsForPlayers } from '../../../entities/subscribers/player-group.subscriber'
import Player from '../../../entities/player'
import { EntityManager } from '@mikro-orm/mysql'

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

          const orm = await getMikroORM()
          const em = orm.em.fork() as EntityManager
          try {
            await checkGroupsForPlayers(em, Array.from(playerSet))
          } finally {
            em.clear()
          }
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
