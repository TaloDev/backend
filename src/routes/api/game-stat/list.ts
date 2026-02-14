import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import GameStat from '../../../entities/game-stat'
import { indexDocs } from './docs'

export const listRoute = apiRoute({
  method: 'get',
  docs: indexDocs,
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_STATS])
  ),
  handler: async (ctx) => {
    const stats = await ctx.em.repo(GameStat).find({ game: ctx.state.game })

    return {
      status: 200,
      body: {
        stats
      }
    }
  }
})
