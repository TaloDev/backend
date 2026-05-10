import { APIKeyScope } from '../../../entities/api-key.js'
import PlayerGameStat from '../../../entities/player-game-stat.js'
import { withResponseCache } from '../../../lib/perf/responseCache.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { listPlayerStatsDocs } from './docs.js'

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
        ttl: 30, // similar to stat snapshot flushing
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
