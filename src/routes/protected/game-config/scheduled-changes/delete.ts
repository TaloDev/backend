import { UserType } from '../../../../entities/user.js'
import { protectedRoute, withMiddleware } from '../../../../lib/routing/router.js'
import { loadGame } from '../../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../../middleware/policy-middleware.js'
import { loadScheduledGameConfigChange } from './common.js'

export const deleteScheduledChangeRoute = protectedRoute({
  method: 'delete',
  path: '/scheduled-changes/:changeId',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'cancel scheduled game config changes'),
    loadGame,
    loadScheduledGameConfigChange,
  ),
  handler: async (ctx) => {
    await ctx.em.remove(ctx.state.scheduledGameConfigChange).flush()

    return {
      status: 204,
    }
  },
})
