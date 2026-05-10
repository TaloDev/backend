import Player from '../../../entities/player.js'
import { getResultCacheOptions } from '../../../lib/perf/getResultCacheOptions.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { HEADLINES_CACHE_TTL_MS } from './common.js'

export const totalPlayersRoute = protectedRoute({
  method: 'get',
  path: '/total_players',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const em = ctx.em

    const game = ctx.state.game
    const includeDevData = ctx.state.includeDevData
    const count = await em.repo(Player).count(
      {
        game,
        ...(includeDevData ? {} : { devBuild: false }),
      },
      getResultCacheOptions(`total-players-${game.id}-${includeDevData}`, HEADLINES_CACHE_TTL_MS),
    )

    return {
      status: 200,
      body: {
        count,
      },
    }
  },
})
