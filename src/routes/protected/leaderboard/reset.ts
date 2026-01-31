import { FilterQuery } from '@mikro-orm/mysql'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import LeaderboardEntry from '../../../entities/leaderboard-entry'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue'
import { resetModes, translateResetMode } from '../../../lib/validation/resetModeValidation'
import { loadLeaderboard } from './common'

export const resetRoute = protectedRoute({
  method: 'delete',
  path: '/:id/entries',
  schema: (z) => ({
    query: z.object({
      mode: z.enum(resetModes, {
        error: `Mode must be one of: ${resetModes.join(', ')}`
      }).optional().default('all')
    })
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'reset leaderboard entries'),
    loadGame,
    loadLeaderboard()
  ),
  handler: async (ctx) => {
    const { mode } = ctx.state.validated.query
    const em = ctx.em
    const leaderboard = ctx.state.leaderboard

    const where: FilterQuery<LeaderboardEntry> = { leaderboard }

    if (mode === 'dev') {
      where.playerAlias = {
        player: {
          devBuild: true
        }
      }
    } else if (mode === 'live') {
      where.playerAlias = {
        player: {
          devBuild: false
        }
      }
    }

    const deletedCount = await em.transactional(async (trx) => {
      const count = await trx.repo(LeaderboardEntry).nativeDelete(where)
      createGameActivity(trx, {
        user: ctx.state.authenticatedUser,
        game: leaderboard.game,
        type: GameActivityType.LEADERBOARD_ENTRIES_RESET,
        extra: {
          leaderboardInternalName: leaderboard.internalName,
          display: {
            'Reset mode': translateResetMode(mode),
            'Deleted count': count
          }
        }
      })

      return count
    })

    await deferClearResponseCache(leaderboard.getEntriesCacheKey(true))

    return {
      status: 200,
      body: {
        deletedCount
      }
    }
  }
})
