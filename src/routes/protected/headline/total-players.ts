import Player from '../../../entities/player'
import { getResultCacheOptions } from '../../../lib/perf/getResultCacheOptions'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { HEADLINES_CACHE_TTL_MS } from './common'

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
