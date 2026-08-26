import { endOfDay, startOfDay } from 'date-fns'
import Player from '../../../entities/player.js'
import { withResponseCache } from '../../../lib/perf/responseCache.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { dateRangeSchema } from '../../../lib/validation/dateRangeSchema.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { HEADLINES_CACHE_TTL } from './common.js'

export const newPlayersRoute = protectedRoute({
  method: 'get',
  path: '/new_players',
  schema: () => ({
    query: dateRangeSchema,
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { startDate, endDate } = ctx.state.validated.query
    const em = ctx.em

    const game = ctx.state.game
    const includeDevData = ctx.state.includeDevData

    return withResponseCache(
      {
        key: `headline-${game.id}-new-players-${includeDevData}-${startDate}-${endDate}`,
        ttl: HEADLINES_CACHE_TTL,
      },
      async () => {
        const count = await em.repo(Player).count({
          game,
          ...(includeDevData ? {} : { devBuild: false }),
          createdAt: {
            $gte: startOfDay(new Date(startDate)),
            $lte: endOfDay(new Date(endDate)),
          },
        })

        return {
          status: 200,
          body: {
            count,
            lastUpdatedAt: Date.now(),
          },
        }
      },
    )
  },
})
