import { APIKeyScope } from '../../../entities/api-key.js'
import PlayerGameStat from '../../../entities/player-game-stat.js'
import { withResponseCache } from '../../../lib/perf/responseCache.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { loadStatWithAlias } from './common.js'
import { getPlayerStatDocs } from './docs.js'

export const getPlayerStatRoute = apiRoute({
  method: 'get',
  path: '/:internalName/player-stat',
  docs: getPlayerStatDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
    route: z.object({
      internalName: z.string().meta({ description: 'The internal name of the stat' }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_STATS]),
    loadAlias,
    loadStatWithAlias,
  ),
  handler: async (ctx) => {
    const stat = ctx.state.stat
    const alias = ctx.state.alias

    return withResponseCache(
      {
        key: PlayerGameStat.getCacheKey(alias.player, stat),
        ttl: 30, // similar to stat snapshot flushing
      },
      async () => {
        const playerStat = await ctx.em.repo(PlayerGameStat).findOne({
          player: alias.player,
          stat,
        })

        return {
          status: 200,
          body: {
            playerStat,
          },
        }
      },
    )
  },
})
