import PlayerGameStatSnapshot from '../../../entities/player-game-stat-snapshot'
import { FlushMetricsQueueHandler, postFlushCheckMemberships } from './flush-metrics-queue-handler'
import { ClickHousePlayerGameStatSnapshot } from '../../../entities/player-game-stat-snapshot'
import { getMikroORM } from '../../../config/mikro-orm.config'
import { EntityManager, raw } from '@mikro-orm/mysql'
import GameStat from '../../../entities/game-stat'

type SerialisedStatSnapshot = ClickHousePlayerGameStatSnapshot & { playerId: string, gameStatId: number }

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
        const playerIds = buildPlayerIdSet(values)

        if (playerIds.size > 0) {
          await postFlushCheckMemberships('FlushStatSnapshotsQueueHandler', Array.from(playerIds))
        }

        const statIds = buildStatIdSet(values)
        if (statIds.size > 0) {
          await recalculateGlobalValues(Array.from(statIds))
        }
      }
    })
  }

  protected serialiseItem(snapshot: PlayerGameStatSnapshot): SerialisedStatSnapshot {
    return {
      ...snapshot.toInsertable(),
      playerId: snapshot.playerAlias.player.id,
      gameStatId: snapshot.stat.id
    }
  }
}

function buildPlayerIdSet(values: SerialisedStatSnapshot[]) {
  return new Set(values.map((item) => item.playerId))
}

function buildStatIdSet(values: SerialisedStatSnapshot[]) {
  return new Set(values.map((item) => item.gameStatId))
}

async function recalculateGlobalValues(statIds: number[]) {
  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  try {
    await em.qb(GameStat, 'gs')
      .update({
        globalValue: raw(`(
          SELECT SUM(pgs.value)
          FROM player_game_stat pgs
          WHERE pgs.stat_id = gs.id
        )`)
      })
      .where({
        id: { $in: statIds },
        global: true
      })
      .execute()
  } finally {
    em.clear()
  }
}
