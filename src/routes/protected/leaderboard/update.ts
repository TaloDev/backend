import { GameActivityType } from '../../../entities/game-activity'
import Leaderboard, {
  LeaderboardSortMode,
  LeaderboardRefreshInterval,
} from '../../../entities/leaderboard'
import updateAllowedKeys from '../../../lib/entities/updateAllowedKeys'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { archiveEntriesForLeaderboard } from '../../../tasks/archiveLeaderboardEntries'
import { loadLeaderboard } from './common'

const sortModeValues = Object.values(LeaderboardSortMode).join(', ')
const refreshIntervalValues = Object.values(LeaderboardRefreshInterval).join(', ')

export const updateRoute = protectedRoute({
  method: 'put',
  path: '/:id',
  schema: (z) => ({
    body: z.object({
      name: z.string().optional(),
      sortMode: z
        .enum(LeaderboardSortMode, {
          error: `Sort mode must be one of ${sortModeValues}`,
        })
        .optional(),
      unique: z.boolean().optional(),
      refreshInterval: z
        .enum(LeaderboardRefreshInterval, {
          error: `Refresh interval must be one of ${refreshIntervalValues}`,
        })
        .optional(),
      uniqueByProps: z.boolean().optional(),
    }),
  }),
  middleware: withMiddleware(loadGame, loadLeaderboard()),
  handler: async (ctx) => {
    const em = ctx.em

    const [leaderboard, changedProperties] = updateAllowedKeys(
      ctx.state.leaderboard as Leaderboard,
      ctx.state.validated.body,
      ['name', 'sortMode', 'unique', 'refreshInterval', 'uniqueByProps'],
    )

    if (
      changedProperties.includes('refreshInterval') &&
      leaderboard.refreshInterval !== LeaderboardRefreshInterval.NEVER
    ) {
      await archiveEntriesForLeaderboard(em, leaderboard)
    }

    await deferClearResponseCache(leaderboard.getEntriesCacheKey(true))

    createGameActivity(em, {
      user: ctx.state.user,
      game: leaderboard.game,
      type: GameActivityType.LEADERBOARD_UPDATED,
      extra: {
        leaderboardInternalName: leaderboard.internalName,
        display: {
          'Updated properties': changedProperties
            .map((prop) => {
              const value = ctx.state.validated.body[prop as keyof typeof ctx.state.validated.body]
              return `${prop}: ${value}`
            })
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
  },
})
