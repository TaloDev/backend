import type z from 'zod'
import { EntityManager } from '@mikro-orm/mysql'
import AdminAPIKey from '../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import LeaderboardEntry from '../../../entities/leaderboard-entry.js'
import { UserType } from '../../../entities/user.js'
import User from '../../../entities/user.js'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { updateLeaderboardEntryBodySchema } from '../../../lib/validation/routes/leaderboards/updateLeaderboardEntryBodySchema.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadLeaderboard } from './common.js'

export async function updateLeaderboardEntryHandler({
  em,
  entry,
  body,
  actor,
}: {
  em: EntityManager
  entry: LeaderboardEntry
  body: z.infer<typeof updateLeaderboardEntryBodySchema>
  actor: User | AdminAPIKey
}) {
  const { hidden, newScore } = body

  if (typeof hidden === 'boolean') {
    entry.hidden = hidden

    createGameActivity(em, {
      actor,
      game: entry.leaderboard.game,
      type: hidden
        ? GameActivityType.LEADERBOARD_ENTRY_HIDDEN
        : GameActivityType.LEADERBOARD_ENTRY_RESTORED,
      extra: {
        leaderboardInternalName: entry.leaderboard.internalName,
        entryId: entry.id,
        display: {
          Player: entry.playerAlias.player.id,
          Score: entry.score,
        },
      },
    })

    await triggerIntegrations(em, entry.leaderboard.game, (integration) => {
      return integration.handleLeaderboardEntryVisibilityToggled(em, entry)
    })
  }

  if (typeof newScore === 'number') {
    const oldScore = entry.score
    entry.score = newScore

    createGameActivity(em, {
      actor,
      game: entry.leaderboard.game,
      type: GameActivityType.LEADERBOARD_ENTRY_UPDATED,
      extra: {
        leaderboardInternalName: entry.leaderboard.internalName,
        entryId: entry.id,
        display: {
          Player: entry.playerAlias.player.id,
          Leaderboard: entry.leaderboard.internalName,
          'Old score': oldScore,
          'New score': newScore,
        },
      },
    })

    await triggerIntegrations(em, entry.leaderboard.game, (integration) => {
      return integration.handleLeaderboardEntryCreated(em, entry)
    })
  }

  await em.flush()

  return {
    status: 200,
    body: {
      entry,
    },
  }
}

export const updateEntryRoute = protectedRoute({
  method: 'patch',
  path: '/:id/entries/:entryId',
  schema: () => ({
    body: updateLeaderboardEntryBodySchema,
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'update leaderboard entries'),
    loadGame,
    loadLeaderboard(true),
  ),
  handler: async (ctx) => {
    const { entryId } = ctx.params as { entryId: string }

    const entry = await ctx.em.repo(LeaderboardEntry).findOne({
      id: Number(entryId),
      leaderboard: ctx.state.leaderboard,
    })

    if (!entry) {
      return ctx.throw(404, 'Leaderboard entry not found')
    }

    return updateLeaderboardEntryHandler({
      em: ctx.em,
      entry,
      body: ctx.state.validated.body,
      actor: ctx.state.user,
    })
  },
})
