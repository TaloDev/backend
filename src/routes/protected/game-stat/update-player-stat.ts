import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations'
import { loadStat, loadPlayerStat, clearStatIndexResponseCache } from './common'

export const updatePlayerStatRoute = protectedRoute({
  method: 'patch',
  path: '/:id/player-stats/:playerStatId',
  schema: (z) => ({
    body: z.object({
      newValue: z.number()
    })
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'update player stats'),
    loadStat,
    loadPlayerStat,
    clearStatIndexResponseCache
  ),
  handler: async (ctx) => {
    const { newValue } = ctx.state.validated.body
    const em = ctx.em
    const playerStat = ctx.state.playerStat
    const oldValue = playerStat.value

    if (newValue < (playerStat.stat.minValue ?? -Infinity)) {
      ctx.throw(400, `Stat would go below the minValue of ${playerStat.stat.minValue}`)
    }

    if (newValue > (playerStat.stat.maxValue ?? Infinity)) {
      ctx.throw(400, `Stat would go above the maxValue of ${playerStat.stat.maxValue}`)
    }

    playerStat.value = newValue
    if (playerStat.stat.global) {
      playerStat.stat.globalValue += newValue - oldValue
    }

    await triggerIntegrations(em, playerStat.player.game, (integration) => {
      return integration.handleStatUpdated(em, playerStat)
    })

    createGameActivity(em, {
      user: ctx.state.authenticatedUser,
      game: playerStat.player.game,
      type: GameActivityType.PLAYER_STAT_UPDATED,
      extra: {
        statInternalName: playerStat.stat.internalName,
        display: {
          'Player': playerStat.player.id,
          'Stat': playerStat.stat.internalName,
          'Old value': oldValue,
          'New value': newValue
        }
      }
    })

    await em.flush()

    return {
      status: 200,
      body: {
        playerStat
      }
    }
  }
})
