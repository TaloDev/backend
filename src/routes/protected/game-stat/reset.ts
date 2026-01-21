import { FilterQuery } from '@mikro-orm/mysql'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import GameStat from '../../../entities/game-stat'
import PlayerGameStat from '../../../entities/player-game-stat'
import PlayerAlias from '../../../entities/player-alias'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue'
import { ResetMode, translateResetMode } from '../../../lib/validation/resetModeValidation'
import { streamByCursor } from '../../../lib/perf/streamByCursor'
import { loadStat } from './common'

const allowedModes: ResetMode[] = ['all', 'live', 'dev']

export const resetRoute = protectedRoute({
  method: 'delete',
  path: '/:id/player-stats',
  schema: (z) => ({
    query: z.object({
      mode: z.enum(['all', 'live', 'dev'], {
        message: `Mode must be one of: ${allowedModes.join(', ')}`
      }).optional().default('all')
    })
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'reset stats'),
    loadStat
  ),
  handler: async (ctx) => {
    const { mode } = ctx.state.validated.query
    const em = ctx.em
    const stat = ctx.state.stat

    const where: FilterQuery<PlayerGameStat> = { stat }

    if (mode === 'dev') {
      where.player = {
        devBuild: true
      }
    } else if (mode === 'live') {
      where.player = {
        devBuild: false
      }
    }

    const deletedCount = await (em.fork()).transactional(async (trx) => {
      const playerIds = await trx.repo(PlayerGameStat).find(where, {
        fields: ['player.id']
      })

      const deletedCount = await trx.repo(PlayerGameStat).nativeDelete(where)
      await trx.repo(GameStat).nativeUpdate(stat.id, { globalValue: stat.defaultValue })

      createGameActivity(trx, {
        user: ctx.state.authenticatedUser,
        game: stat.game,
        type: GameActivityType.GAME_STAT_RESET,
        extra: {
          statInternalName: stat.internalName,
          display: {
            'Reset mode': translateResetMode(mode),
            'Deleted count': deletedCount
          }
        }
      })

      const clickhouse = ctx.clickhouse
      const aliasStream = streamByCursor<{ id: number }>(async (batchSize, after) => {
        return trx.repo(PlayerAlias).findByCursor({
          player: { id: playerIds.map((p) => p.player.id) }
        }, {
          first: batchSize,
          after,
          orderBy: { id: 'asc' },
          fields: ['id'],
          strategy: 'joined'
        })
      }, 1000)

      const query = `
        DELETE FROM player_game_stat_snapshots
        WHERE
          game_stat_id = ${stat.id}
          AND player_alias_id IN ({aliasIds:Array(UInt32)})
      `
      const aliasIds: number[] = []
      const CLICKHOUSE_BATCH_SIZE = 100

      for await (const alias of aliasStream) {
        aliasIds.push(alias.id)

        if (aliasIds.length >= CLICKHOUSE_BATCH_SIZE) {
          const batchIds = aliasIds.splice(0, CLICKHOUSE_BATCH_SIZE)
          await clickhouse.exec({
            query,
            query_params: {
              aliasIds: batchIds
            }
          })
        }
      }

      // delete any remaining unspliced aliases
      if (aliasIds.length > 0) {
        await clickhouse.exec({
          query,
          query_params: {
            aliasIds
          }
        })
      }

      return deletedCount
    })

    await Promise.allSettled([
      deferClearResponseCache(GameStat.getIndexCacheKey(stat.game, true)),
      deferClearResponseCache(PlayerGameStat.getCacheKeyForStat(stat, true))
    ])

    return {
      status: 200,
      body: {
        deletedCount
      }
    }
  }
})
