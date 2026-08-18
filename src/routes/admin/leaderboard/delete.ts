import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { deleteLeaderboardHandler } from '../../protected/leaderboard/delete.js'
import { loadLeaderboard } from './common.js'
import { deleteDocs } from './docs.js'

export const deleteLeaderboardAdminRoute = adminRoute({
  method: 'delete',
  path: '/:id',
  docs: deleteDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the leaderboard' }),
    }),
  }),
  middleware: withMiddleware(
    requireAdminScopes([AdminAPIKeyScope.WRITE_LEADERBOARDS]),
    loadLeaderboard,
  ),
  handler: (ctx) =>
    deleteLeaderboardHandler({
      em: ctx.em,
      leaderboard: ctx.state.leaderboard,
      actor: ctx.state.key,
    }),
})
