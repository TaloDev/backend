import { AdminAPIKeyScope } from '../../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../../lib/routing/router.js'
import { createScheduledGameConfigChangesBodySchema } from '../../../../lib/validation/routes/game-config/createScheduledGameConfigChangesBodySchema.js'
import { requireAdminScopes } from '../../../../middleware/policy-middleware.js'
import { createScheduledGameConfigChangesHandler } from '../../../protected/game-config/scheduled-changes/create.js'
import { loadGameConfig } from '../common.js'
import { createScheduledChangesDocs } from '../docs.js'

export const createScheduledChangeAdminRoute = adminRoute({
  method: 'post',
  path: '/scheduled-changes',
  docs: createScheduledChangesDocs,
  schema: (z) => ({
    body: createScheduledGameConfigChangesBodySchema(z),
  }),
  middleware: withMiddleware(
    requireAdminScopes([AdminAPIKeyScope.WRITE_GAME_CONFIG]),
    loadGameConfig,
  ),
  handler: (ctx) =>
    createScheduledGameConfigChangesHandler({
      em: ctx.em,
      game: ctx.state.game,
      actor: ctx.state.key,
      data: ctx.state.validated.body,
    }),
})
