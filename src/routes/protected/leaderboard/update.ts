import { EntityManager } from '@mikro-orm/mysql'
import { z } from 'zod'
import AdminAPIKey from '../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import Leaderboard, { LeaderboardRefreshInterval } from '../../../entities/leaderboard.js'
import User from '../../../entities/user.js'
import updateAllowedKeys from '../../../lib/entities/updateAllowedKeys.js'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { updateLeaderboardBodySchema } from '../../../lib/validation/routes/leaderboards/updateLeaderboardBodySchema.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { archiveEntriesForLeaderboard } from '../../../tasks/archiveLeaderboardEntries.js'
import { loadLeaderboard } from './common.js'

export async function updateLeaderboardHandler({
  em,
  leaderboard,
  body,
  actor,
}: {
  em: EntityManager
  leaderboard: Leaderboard
  body: z.infer<ReturnType<typeof updateLeaderboardBodySchema>>
  actor: User | AdminAPIKey
}) {
  const [, changedProperties] = updateAllowedKeys(leaderboard, body, [
    'name',
    'sortMode',
    'unique',
    'refreshInterval',
    'uniqueByProps',
  ])

  if (
    changedProperties.includes('refreshInterval') &&
    leaderboard.refreshInterval !== LeaderboardRefreshInterval.NEVER
  ) {
    await archiveEntriesForLeaderboard(em, leaderboard)
  }

  await deferClearResponseCache(leaderboard.getEntriesCacheKey(true))

  createGameActivity(em, {
    actor,
    game: leaderboard.game,
    type: GameActivityType.LEADERBOARD_UPDATED,
    extra: {
      leaderboardInternalName: leaderboard.internalName,
      display: {
        'Updated properties': changedProperties
          .map((prop) => `${prop}: ${body[prop as keyof typeof body]}`)
          .join(', '),
      },
    },
  })

  await em.flush()

  await triggerIntegrations(em, leaderboard.game, (integration) => {
    return integration.handleLeaderboardUpdated(em, leaderboard)
  })

  return {
    status: 200,
    body: {
      leaderboard,
    },
  }
}

export const updateRoute = protectedRoute({
  method: 'put',
  path: '/:id',
  schema: (z) => ({
    body: updateLeaderboardBodySchema(z),
  }),
  middleware: withMiddleware(loadGame, loadLeaderboard()),
  handler: async (ctx) => {
    return updateLeaderboardHandler({
      em: ctx.em,
      leaderboard: ctx.state.leaderboard as Leaderboard,
      body: ctx.state.validated.body,
      actor: ctx.state.user,
    })
  },
})
