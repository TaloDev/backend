import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { Redis } from 'ioredis'
import { getMikroORM } from '../../../config/mikro-orm.config'
import GameStat from '../../../entities/game-stat'
import PlayerGameStatSnapshot from '../../../entities/player-game-stat-snapshot'
import { ClickHousePlayerGameStatSnapshot } from '../../../entities/player-game-stat-snapshot'
import { FlushMetricsQueueHandler, postFlushCheckMemberships } from './flush-metrics-queue-handler'

type SerialisedStatSnapshot = ClickHousePlayerGameStatSnapshot & {
  playerId: string
  gameStatId: number
}

export class FlushStatSnapshotsQueueHandler extends FlushMetricsQueueHandler<
  PlayerGameStatSnapshot,
  SerialisedStatSnapshot
> {
  constructor() {
    super(
      'stat-snapshots',
      async (clickhouse, values) => {
        await clickhouse.insert({
          table: 'player_game_stat_snapshots',
          values,
          format: 'JSONEachRow',
        })
      },
      {
        postFlush: async (values) => {
          const playerIds = buildPlayerIdSet(values)

          if (playerIds.size > 0) {
            await postFlushCheckMemberships('FlushStatSnapshotsQueueHandler', Array.from(playerIds))
          }

          const statIds = buildStatIdSet(values)
          await syncGlobalValuesFromRedis(this.getRedis(), Array.from(statIds))
        },
      },
    )
  }

  protected serialiseItem(snapshot: PlayerGameStatSnapshot): SerialisedStatSnapshot {
    return {
      ...snapshot.toInsertable(),
      playerId: snapshot.playerAlias.player.id,
      gameStatId: snapshot.stat.id,
    }
  }
}

function buildPlayerIdSet(values: SerialisedStatSnapshot[]) {
  return new Set(values.map((item) => item.playerId))
}

function buildStatIdSet(values: SerialisedStatSnapshot[]) {
  return new Set(values.map((item) => item.gameStatId))
}

async function syncGlobalValuesFromRedis(redis: Redis, statIds: number[]) {
  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  try {
    const keys = statIds.map((id) => GameStat.getGlobalValueCacheKey(id))
    const values = await redis.mget(...keys)

    const updates = statIds
      .map((statId, idx) => ({ id: statId, value: values[idx] }))
      .filter((update) => update.value !== null)

    for (const { id, value } of updates) {
      try {
        await em
          .qb(GameStat, 'gs')
          .update({ globalValue: Number(value) })
          .where({ id, global: true })
          .execute()
      } catch (err) {
        captureException(err)
      }
    }
  } finally {
    em.clear()
  }
}
