import { FilterQuery } from '@mikro-orm/mysql'
import { GameActivityType } from '../../../entities/game-activity.js'
import LeaderboardEntry from '../../../entities/leaderboard-entry.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { resetModes, translateResetMode } from '../../../lib/validation/resetModeValidation.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadLeaderboard } from './common.js'

export const resetRoute = protectedRoute({
  method: 'delete',
  path: '/:id/entries',
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
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'reset leaderboard entries'),
    loadGame,
    loadLeaderboard(),
  ),
  handler: async (ctx) => {
    const { mode } = ctx.state.validated.query
    const em = ctx.em
    const leaderboard = ctx.state.leaderboard

    const where: FilterQuery<LeaderboardEntry> = { leaderboard }

    if (mode === 'dev') {
      where.playerAlias = {
        player: {
          devBuild: true,
        },
      }
    } else if (mode === 'live') {
      where.playerAlias = {
        player: {
          devBuild: false,
        },
      }
    }

    const deletedCount = await em.transactional(async (trx) => {
      const count = await trx.repo(LeaderboardEntry).nativeDelete(where)
      createGameActivity(trx, {
        user: ctx.state.user,
        game: leaderboard.game,
        type: GameActivityType.LEADERBOARD_ENTRIES_RESET,
        extra: {
          leaderboardInternalName: leaderboard.internalName,
          display: {
            'Reset mode': translateResetMode(mode),
            'Deleted count': count,
          },
        },
      })

      return count
    })

    await deferClearResponseCache(leaderboard.getEntriesCacheKey(true))

    return {
      status: 200,
      body: {
        deletedCount,
      },
    }
  },
})
