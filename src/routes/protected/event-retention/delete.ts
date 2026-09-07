import { z } from 'zod'
import EventRetention from '../../../entities/event-retention.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'

export const deleteRoute = protectedRoute({
  method: 'delete',
  schema: () => ({
    query: z.object({
      eventName: z.string().min(1).max(255),
    }),
  }),
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'delete event retention'), loadGame),
  handler: async (ctx) => {
    const { eventName } = ctx.state.validated.query

    await ctx.em.repo(EventRetention).nativeDelete({
      game: ctx.state.game,
      eventName,
    })

    createGameActivity(ctx.em, {
      actor: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.EVENT_RETENTION_DELETED,
      extra: {
        eventName,
        display: {
          'Event name': eventName,
        },
      },
    })
    await ctx.em.flush()

    return {
      status: 204,
    }
  },
})
