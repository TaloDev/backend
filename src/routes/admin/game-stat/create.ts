import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { createStatBodySchema } from '../../protected/game-stat/common.js'
import { createStatHandler } from '../../protected/game-stat/create.js'
import { createDocs } from './docs.js'

export const createStatAdminRoute = adminRoute({
  method: 'post',
  docs: createDocs,
  schema: (z) => ({
    body: createStatBodySchema(z),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.WRITE_STATS])),
  handler: (ctx) =>
    createStatHandler({
      em: ctx.em,
      game: ctx.state.game,
      actor: ctx.state.key,
      data: ctx.state.validated.body,
    }),
})
