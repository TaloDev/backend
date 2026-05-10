import { APIKeyScope } from '../../../entities/api-key.js'
import GameStat from '../../../entities/game-stat.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { indexDocs } from './docs.js'

export const listRoute = apiRoute({
  method: 'get',
  docs: indexDocs,
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_GAME_STATS])),
  handler: async (ctx) => {
    const stats = await ctx.em.repo(GameStat).find({ game: ctx.state.game })

    return {
      status: 200,
      body: {
        stats,
      },
    }
  },
})
