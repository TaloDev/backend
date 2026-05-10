import { endOfDay, startOfDay } from 'date-fns'
import Player from '../../../entities/player.js'
import { getResultCacheOptions } from '../../../lib/perf/getResultCacheOptions.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { dateRangeSchema } from '../../../lib/validation/dateRangeSchema.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { HEADLINES_CACHE_TTL_MS } from './common.js'

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
    const count = await em.repo(Player).count(
      {
        game,
        ...(includeDevData ? {} : { devBuild: false }),
        createdAt: {
          $gte: startOfDay(new Date(startDate)),
          $lte: endOfDay(new Date(endDate)),
        },
      },
      getResultCacheOptions(
        `new-players-${game.id}-${includeDevData}-${startDate}-${endDate}`,
        HEADLINES_CACHE_TTL_MS,
      ),
    )

    return {
      status: 200,
      body: {
        count,
      },
    }
  },
})
