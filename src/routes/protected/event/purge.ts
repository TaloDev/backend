import { z } from 'zod'
import Event from '../../../entities/event.js'
import GameActivity, { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import { purgeEvents } from '../../../lib/clickhouse/purgeEvents.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'

export const purgeRoute = protectedRoute({
  method: 'delete',
  path: '/purge',
  schema: () => ({
    query: z.object({
      eventName: z.string().min(1),
    }),
  }),
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'purge events'), loadGame),
  handler: async (ctx) => {
    const { eventName } = ctx.state.validated.query

    const purged = await purgeEvents(ctx.clickhouse, ctx.state.game.id, eventName)

    if (purged > 0) {
      await Event.clearCatalogueCache(ctx.state.game)
    }

    createGameActivity(ctx.em, {
      actor: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.EVENTS_PURGED,
      extra: {
        eventName,
        count: purged,
        display: {
          'Event name': eventName,
          'Events deleted': purged,
        },
      },
    })
    await ctx.em.flush()

    return {
      status: 200,
      body: {
        purged,
      },
    }
  },
})
