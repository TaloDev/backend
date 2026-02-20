import { APIKeyScope } from '../../../entities/api-key'
import PlayerGameStat from '../../../entities/player-game-stat'
import { withResponseCache } from '../../../lib/perf/responseCache'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { requireScopes } from '../../../middleware/policy-middleware'
import { listPlayerStatsDocs } from './docs'

export const listPlayerStatsRoute = apiRoute({
  method: 'get',
  path: '/player-stats',
  docs: listPlayerStatsDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_GAME_STATS]), loadAlias),
  handler: async (ctx) => {
    const alias = ctx.state.alias

    return withResponseCache(
      {
        key: PlayerGameStat.getListCacheKey(alias.player),
        slidingWindow: true,
      },
      async () => {
        const playerStats = await ctx.em.repo(PlayerGameStat).find({
          player: alias.player,
        })

        return {
          status: 200,
          body: {
            playerStats,
          },
        }
      },
    )
  },
})
