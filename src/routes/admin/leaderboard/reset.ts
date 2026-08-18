import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { resetModeQuerySchema } from '../../../lib/validation/resetModeValidation.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { resetLeaderboardEntriesHandler } from '../../protected/leaderboard/reset.js'
import { loadLeaderboard } from './common.js'
import { resetDocs } from './docs.js'

export const resetLeaderboardAdminRoute = adminRoute({
  method: 'delete',
  path: '/:id/entries',
  docs: resetDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the leaderboard' }),
    }),
    query: resetModeQuerySchema,
  }),
  middleware: withMiddleware(
    requireAdminScopes([AdminAPIKeyScope.WRITE_LEADERBOARDS]),
    loadLeaderboard,
  ),
  handler: (ctx) =>
    resetLeaderboardEntriesHandler({
      em: ctx.em,
      leaderboard: ctx.state.leaderboard,
      mode: ctx.state.validated.query.mode,
      actor: ctx.state.key,
    }),
})
