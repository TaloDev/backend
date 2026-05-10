import { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadStat, loadPlayerStat, clearStatIndexResponseCache } from './common.js'

export const updatePlayerStatRoute = protectedRoute({
  method: 'patch',
  path: '/:id/player-stats/:playerStatId',
  schema: (z) => ({
    body: z.object({
      newValue: z.number(),
    }),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'update player stats'),
    loadStat,
    loadPlayerStat,
    clearStatIndexResponseCache,
  ),
  handler: async (ctx) => {
    const { newValue } = ctx.state.validated.body
    const em = ctx.em
    const playerStat = ctx.state.playerStat
    const oldValue = playerStat.value

    if (newValue < (playerStat.stat.minValue ?? -Infinity)) {
      return ctx.throw(400, `Stat would go below the minValue of ${playerStat.stat.minValue}`)
    }

    if (newValue > (playerStat.stat.maxValue ?? Infinity)) {
      return ctx.throw(400, `Stat would go above the maxValue of ${playerStat.stat.maxValue}`)
    }

    playerStat.value = newValue
    if (playerStat.stat.global) {
      await playerStat.stat.incrementGlobalValue(ctx.redis, newValue - oldValue)
    }

    await triggerIntegrations(em, playerStat.player.game, (integration) => {
      return integration.handleStatUpdated(em, playerStat)
    })

    createGameActivity(em, {
      user: ctx.state.user,
      game: playerStat.player.game,
      type: GameActivityType.PLAYER_STAT_UPDATED,
      extra: {
        statInternalName: playerStat.stat.internalName,
        display: {
          Player: playerStat.player.id,
          Stat: playerStat.stat.internalName,
          'Old value': oldValue,
          'New value': newValue,
        },
      },
    })

    await em.flush()

    return {
      status: 200,
      body: {
        playerStat,
      },
    }
  },
})
