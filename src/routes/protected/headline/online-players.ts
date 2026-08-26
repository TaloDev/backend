import Player from '../../../entities/player.js'
import { withResponseCache } from '../../../lib/perf/responseCache.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { ONLINE_PLAYERS_CACHE_TTL } from './common.js'

export const onlinePlayersRoute = protectedRoute({
  method: 'get',
  path: '/online_players',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const em = ctx.em

    const game = ctx.state.game
    const includeDevData = ctx.state.includeDevData

    return withResponseCache(
      {
        key: `headline-${game.id}-online-players-${includeDevData}`,
        ttl: ONLINE_PLAYERS_CACHE_TTL,
      },
      async () => {
        const count = await em.repo(Player).count({
          game,
          ...(includeDevData ? {} : { devBuild: false }),
          presence: {
            online: true,
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
