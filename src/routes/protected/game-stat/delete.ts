import { GameActivityType } from '../../../entities/game-activity.js'
import GameStat from '../../../entities/game-stat.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { clearStatIndexResponseCache, loadStat } from './common.js'

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'delete stats'),
    loadStat,
    clearStatIndexResponseCache,
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const stat = ctx.state.stat

    createGameActivity(em, {
      actor: ctx.state.user,
      game: stat.game,
      type: GameActivityType.GAME_STAT_DELETED,
      extra: {
        statInternalName: stat.internalName,
      },
    })

    await em.remove(stat).flush()
    await deferClearResponseCache(GameStat.getIndexCacheKey(stat.game, true))

    return {
      status: 204,
    }
  },
})
