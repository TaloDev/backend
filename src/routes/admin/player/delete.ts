import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { deletePlayerHandler } from '../../protected/player/delete.js'
import { loadPlayer } from './common.js'
import { deleteDocs } from './docs.js'

export const deletePlayerAdminRoute = adminRoute({
  method: 'delete',
  path: '/:id',
  docs: deleteDocs,
  schema: (z) => ({
    route: z.object({
      id: z.string().meta({ description: 'The ID of the player' }),
    }),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.WRITE_PLAYERS]), loadPlayer),
  handler: (ctx) =>
    deletePlayerHandler({
      em: ctx.em,
      player: ctx.state.player,
      actor: ctx.state.key,
    }),
})
