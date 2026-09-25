import { GameActivityType } from '../../../../entities/game-activity.js'
import { UserType } from '../../../../entities/user.js'
import createGameActivity from '../../../../lib/logging/createGameActivity.js'
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
    const em = ctx.em
    const change = ctx.state.scheduledGameConfigChange

    createGameActivity(em, {
      actor: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.GAME_PROPS_SCHEDULED_CHANGE_CANCELLED,
      extra: {
        display: {
          'Scheduled prop': `${change.key}: ${change.value ?? '[deleted]'}`,
        },
      },
    })

    await em.remove(change).flush()

    return {
      status: 204,
    }
  },
})
