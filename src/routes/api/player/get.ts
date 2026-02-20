import { APIKeyScope } from '../../../entities/api-key'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { loadPlayerWithAliases } from './common'
import { getDocs } from './docs'

export const getRoute = apiRoute({
  method: 'get',
  path: '/:id',
  docs: getDocs,
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_PLAYERS]), loadPlayerWithAliases),
  handler: (ctx) => {
    return {
      status: 200,
      body: {
        player: ctx.state.player,
      },
    }
  },
})
