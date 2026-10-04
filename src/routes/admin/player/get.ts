import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { getPlayerHandler } from '../../protected/player/get.js'
import { loadPlayer } from './common.js'
import { getDocs } from './docs.js'

export const getPlayerAdminRoute = adminRoute({
  method: 'get',
  path: '/:id',
  docs: getDocs,
  schema: (z) => ({
    route: z.object({
      id: z.string().meta({ description: 'The ID of the player' }),
    }),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.READ_PLAYERS]), loadPlayer),
  handler: (ctx) => getPlayerHandler({ player: ctx.state.player }),
})
