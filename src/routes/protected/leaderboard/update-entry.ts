import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import LeaderboardEntry from '../../../entities/leaderboard-entry'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations'
import { loadLeaderboard } from './common'

export const updateEntryRoute = protectedRoute({
  method: 'patch',
  path: '/:id/entries/:entryId',
  schema: (z) => ({
    body: z.object({
      hidden: z.boolean().optional(),
      newScore: z.number().optional()
    })
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'update leaderboard entries'),
    loadGame,
    loadLeaderboard(true)
  ),
  handler: async (ctx) => {
    const { entryId } = ctx.params as { entryId: string }
    const { hidden, newScore } = ctx.state.validated.body
    const em = ctx.em

    const entry = await em.repo(LeaderboardEntry).findOne({
      id: Number(entryId),
      leaderboard: ctx.state.leaderboard
    })

    if (!entry) {
      return ctx.throw(404, 'Leaderboard entry not found')
    }

    if (typeof hidden === 'boolean') {
      entry.hidden = hidden

      createGameActivity(em, {
        user: ctx.state.authenticatedUser,
        game: entry.leaderboard.game,
        type: hidden ? GameActivityType.LEADERBOARD_ENTRY_HIDDEN : GameActivityType.LEADERBOARD_ENTRY_RESTORED,
        extra: {
          leaderboardInternalName: entry.leaderboard.internalName,
          entryId: entry.id,
          display: {
            'Player': entry.playerAlias.player.id,
            'Score': entry.score
          }
        }
      })

      await triggerIntegrations(em, entry.leaderboard.game, (integration) => {
        return integration.handleLeaderboardEntryVisibilityToggled(em, entry)
      })
    }

    if (typeof newScore === 'number') {
      const oldScore = entry.score
      entry.score = newScore

      createGameActivity(em, {
        user: ctx.state.authenticatedUser,
        game: entry.leaderboard.game,
        type: GameActivityType.LEADERBOARD_ENTRY_UPDATED,
        extra: {
          leaderboardInternalName: entry.leaderboard.internalName,
          entryId: entry.id,
          display: {
            'Player': entry.playerAlias.player.id,
            'Leaderboard': entry.leaderboard.internalName,
            'Old score': oldScore,
            'New score': newScore
          }
        }
      })

      await triggerIntegrations(em, entry.leaderboard.game, (integration) => {
        return integration.handleLeaderboardEntryCreated(em, entry)
      })
    }

    await em.flush()

    return {
      status: 200,
      body: {
        entry
      }
    }
  }
})
