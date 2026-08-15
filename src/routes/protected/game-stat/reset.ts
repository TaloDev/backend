import type { ClickHouseClient } from '@clickhouse/client'
import type { Redis } from 'ioredis'
import { FilterQuery } from '@mikro-orm/mysql'
import { EntityManager } from '@mikro-orm/mysql'
import AdminAPIKey from '../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import GameStat from '../../../entities/game-stat.js'
import PlayerAlias from '../../../entities/player-alias.js'
import PlayerGameStat from '../../../entities/player-game-stat.js'
import User, { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { streamByCursor } from '../../../lib/perf/streamByCursor.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import {
  ResetMode,
  resetModes,
  translateResetMode,
} from '../../../lib/validation/resetModeValidation.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadStat } from './common.js'

export async function resetStatHandler({
  em,
  stat,
  actor,
  mode,
  clickhouse,
  redis,
}: {
  em: EntityManager
  stat: GameStat
  actor: User | AdminAPIKey
  mode: ResetMode
  clickhouse: ClickHouseClient
  redis: Redis
}) {
  const where: FilterQuery<PlayerGameStat> = { stat }

  if (mode === 'dev') {
    where.player = {
      devBuild: true,
    }
  } else if (mode === 'live') {
    where.player = {
      devBuild: false,
    }
  }

  const deletedCount = await em.fork().transactional(async (trx) => {
    const playerIds = await trx.repo(PlayerGameStat).find(where, {
      fields: ['player.id'],
    })

    const deletedCount = await trx.repo(PlayerGameStat).nativeDelete(where)

    await stat.recalculateGlobalValue({
      em: trx,
      includeDevData: mode !== 'dev',
      devOnly: mode === 'live',
    })
    await trx.repo(GameStat).nativeUpdate(stat.id, { globalValue: stat.globalValue })

    createGameActivity(trx, {
      actor,
      game: stat.game,
      type: GameActivityType.GAME_STAT_RESET,
      extra: {
        statInternalName: stat.internalName,
        display: {
          'Reset mode': translateResetMode(mode),
          'Deleted count': deletedCount,
        },
      },
    })

    const aliasStream = streamByCursor<PlayerAlias, never, 'id'>(async (batchSize, after) => {
      return trx.repo(PlayerAlias).findByCursor({
        where: {
          player: { id: playerIds.map((p) => p.player.id) },
        },
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
        fields: ['id'],
        strategy: 'joined',
      })
    }, 1000)

    const query = `
      DELETE FROM player_game_stat_snapshots
      WHERE
        game_stat_id = {statId:UInt32}
        AND player_alias_id IN ({aliasIds:Array(UInt32)})
    `
    const aliasIds: number[] = []
    const CLICKHOUSE_BATCH_SIZE = 100

    for await (const alias of aliasStream) {
      aliasIds.push(alias.id)

      if (aliasIds.length >= CLICKHOUSE_BATCH_SIZE) {
        const batchIds = aliasIds.splice(0, CLICKHOUSE_BATCH_SIZE)
        await clickhouse.command({
          query,
          query_params: {
            statId: stat.id,
            aliasIds: batchIds,
          },
        })
      }
    }

    // delete any remaining unspliced aliases
    if (aliasIds.length > 0) {
      await clickhouse.command({
        query,
        query_params: {
          statId: stat.id,
          aliasIds,
        },
      })
    }

    return deletedCount
  })

  await em.refresh(stat)
  await redis.set(GameStat.getGlobalValueCacheKey(stat.id), stat.globalValue)

  await Promise.allSettled([
    deferClearResponseCache(GameStat.getIndexCacheKey(stat.game, true)),
    deferClearResponseCache(PlayerGameStat.getCacheKeyForStat(stat, true)),
  ])

  return {
    status: 200,
    body: {
      deletedCount,
    },
  }
}

export const resetRoute = protectedRoute({
  method: 'delete',
  path: '/:id/player-stats',
  schema: (z) => ({
    query: z.object({
      mode: z
        .enum(resetModes, {
          error: `Mode must be one of: ${resetModes.join(', ')}`,
        })
        .optional()
        .default('all'),
    }),
  }),
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'reset stats'), loadStat),
  handler: async (ctx) => {
    const { mode } = ctx.state.validated.query

    return resetStatHandler({
      em: ctx.em,
      stat: ctx.state.stat,
      actor: ctx.state.user,
      mode,
      clickhouse: ctx.clickhouse,
      redis: ctx.redis,
    })
  },
})
