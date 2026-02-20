import Player from '../../../entities/player'
import { getResultCacheOptions } from '../../../lib/perf/getResultCacheOptions'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { ONLINE_PLAYERS_CACHE_TTL_MS } from './common'

export const onlinePlayersRoute = protectedRoute({
  method: 'get',
  path: '/online_players',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const em = ctx.em

    const game = ctx.state.game
    const includeDevData = ctx.state.includeDevData
    const count = await em.repo(Player).count(
      {
        game,
        ...(includeDevData ? {} : { devBuild: false }),
        presence: {
          online: true,
        },
      },
      getResultCacheOptions(
        `online-players-${game.id}-${includeDevData}`,
        ONLINE_PLAYERS_CACHE_TTL_MS,
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
