import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { updateStatBodySchema } from '../../protected/game-stat/common.js'
import { updateStatHandler } from '../../protected/game-stat/update.js'
import { loadStat } from './common.js'

export const updateStatAdminRoute = adminRoute({
  method: 'put',
  path: '/:id',
  schema: (z) => ({
    body: updateStatBodySchema(z),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.WRITE_STATS]), loadStat),
  handler: (ctx) =>
    updateStatHandler({
      em: ctx.em,
      stat: ctx.state.stat,
      body: ctx.state.validated.body,
      actor: ctx.state.key,
    }),
})
