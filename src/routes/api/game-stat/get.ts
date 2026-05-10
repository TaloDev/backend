import { APIKeyScope } from '../../../entities/api-key.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { loadStat } from './common.js'
import { getDocs } from './docs.js'

export const getRoute = apiRoute({
  method: 'get',
  path: '/:internalName',
  docs: getDocs,
  schema: (z) => ({
    route: z.object({
      internalName: z.string().meta({ description: 'The internal name of the stat' }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_GAME_STATS]), loadStat),
  handler: async (ctx) => {
    return {
      status: 200,
      body: {
        stat: ctx.state.stat,
      },
    }
  },
})
