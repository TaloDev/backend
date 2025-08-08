import { MikroORM } from '@mikro-orm/core'
import PlayerGameStatSnapshot from '../../../entities/player-game-stat-snapshot'
import { FlushMetricsQueueHandler } from './flush-metrics-queue-handler'
import ormConfig from '../../../config/mikro-orm.config'
import { checkGroupsForPlayers } from '../../../entities/subscribers/player-group.subscriber'

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

          const orm = await MikroORM.init(ormConfig)
          const em = orm.em.fork()
          await checkGroupsForPlayers(em, Array.from(playerSet))
          await orm.close()
        }
      }
    })
  }

  buildPlayerSet(values: PlayerGameStatSnapshot[]) {
    const players = values.map((snapshot) => snapshot.playerAlias.player)
    const playerIdSet = new Set(players.map((player) => player.id))
    return new Set(players.filter((player) => playerIdSet.has(player.id)))
  }
}
