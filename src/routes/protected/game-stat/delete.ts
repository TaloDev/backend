import { GameActivityType } from '../../../entities/game-activity'
import { UserType } from '../../../entities/user'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { clearStatIndexResponseCache, loadStat } from './common'

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
      user: ctx.state.user,
      game: stat.game,
      type: GameActivityType.GAME_STAT_DELETED,
      extra: {
        statInternalName: stat.internalName,
      },
    })

    await em.remove(stat).flush()

    return {
      status: 204,
    }
  },
})
