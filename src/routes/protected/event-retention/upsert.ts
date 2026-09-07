import { z } from 'zod'
import EventRetention from '../../../entities/event-retention.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'

export const upsertRoute = protectedRoute({
  method: 'put',
  schema: () => ({
    body: z.object({
      eventName: z.string().min(1).max(255),
      retentionDays: z.number().int().min(1).max(36500),
    }),
  }),
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'configure event retention'), loadGame),
  handler: async (ctx) => {
    const { eventName, retentionDays } = ctx.state.validated.body
    const em = ctx.em

    const retention = await em.repo(EventRetention).upsert({
      game: ctx.state.game,
      eventName,
      retentionDays,
      updatedAt: new Date(),
    })

    createGameActivity(em, {
      actor: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.EVENT_RETENTION_UPDATED,
      extra: {
        eventName,
        retentionDays,
        display: {
          'Event name': eventName,
          'Retention days': retentionDays,
        },
      },
    })

    await em.flush()

    return {
      status: 200,
      body: {
        retention,
      },
    }
  },
})
