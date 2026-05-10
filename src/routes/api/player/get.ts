import { APIKeyScope } from '../../../entities/api-key.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { loadPlayerWithAliases } from './common.js'
import { getDocs } from './docs.js'

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
