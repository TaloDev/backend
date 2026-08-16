import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { deleteStatHandler } from '../../protected/game-stat/delete.js'
import { loadStat } from './common.js'
import { deleteDocs } from './docs.js'

export const deleteStatAdminRoute = adminRoute({
  method: 'delete',
  path: '/:id',
  docs: deleteDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the stat' }),
    }),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.WRITE_STATS]), loadStat),
  handler: (ctx) =>
    deleteStatHandler({
      em: ctx.em,
      stat: ctx.state.stat,
      actor: ctx.state.key,
    }),
})
