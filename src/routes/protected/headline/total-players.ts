import Player from '../../../entities/player.js'
import { withResponseCache } from '../../../lib/perf/responseCache.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { HEADLINES_CACHE_TTL } from './common.js'

export const totalPlayersRoute = protectedRoute({
  method: 'get',
  path: '/total_players',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const em = ctx.em

    const game = ctx.state.game
    const includeDevData = ctx.state.includeDevData

    return withResponseCache(
      {
        key: `headline-${game.id}-total-players-${includeDevData}`,
        ttl: HEADLINES_CACHE_TTL,
      },
      async () => {
        const count = await em.repo(Player).count({
          game,
          ...(includeDevData ? {} : { devBuild: false }),
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
