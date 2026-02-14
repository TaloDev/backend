import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import PlayerGameStat from '../../../entities/player-game-stat'
import { withResponseCache } from '../../../lib/perf/responseCache'
import { loadStatWithAlias } from './common'
import { getPlayerStatDocs } from './docs'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'

export const getPlayerStatRoute = apiRoute({
  method: 'get',
  path: '/:internalName/player-stat',
  docs: getPlayerStatDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema
    }),
    route: z.object({
      internalName: z.string().meta({ description: 'The internal name of the stat' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_STATS]),
    loadAlias,
    loadStatWithAlias
  ),
  handler: async (ctx) => {
    const stat = ctx.state.stat
    const alias = ctx.state.alias

    return withResponseCache({
      key: PlayerGameStat.getCacheKey(alias.player, stat),
      slidingWindow: true
    }, async () => {
      const playerStat = await ctx.em.repo(PlayerGameStat).findOne({
        player: alias.player,
        stat
      })

      return {
        status: 200,
        body: {
          playerStat
        }
      }
    })
  }
})
