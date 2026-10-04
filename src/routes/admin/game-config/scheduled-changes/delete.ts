import { AdminAPIKeyScope } from '../../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../../lib/routing/router.js'
import { numericStringSchema } from '../../../../lib/validation/numericStringSchema.js'
import { requireAdminScopes } from '../../../../middleware/policy-middleware.js'
import { deleteScheduledGameConfigChangeHandler } from '../../../protected/game-config/scheduled-changes/delete.js'
import { deleteScheduledChangeDocs } from '../docs.js'
import { loadScheduledGameConfigChange } from './common.js'

export const deleteScheduledChangeAdminRoute = adminRoute({
  method: 'delete',
  path: '/scheduled-changes/:changeId',
  docs: deleteScheduledChangeDocs,
  schema: (z) => ({
    route: z.object({
      changeId: numericStringSchema.meta({ description: 'The ID of the scheduled change' }),
    }),
  }),
  middleware: withMiddleware(
    requireAdminScopes([AdminAPIKeyScope.WRITE_GAME_CONFIG]),
    loadScheduledGameConfigChange,
  ),
  handler: (ctx) =>
    deleteScheduledGameConfigChangeHandler({
      em: ctx.em,
      game: ctx.state.game,
      change: ctx.state.scheduledGameConfigChange,
      actor: ctx.state.key,
    }),
})
