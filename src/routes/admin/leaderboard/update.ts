import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { updateLeaderboardBodySchema } from '../../../lib/validation/routes/leaderboards/updateLeaderboardBodySchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { updateLeaderboardHandler } from '../../protected/leaderboard/update.js'
import { loadLeaderboard } from './common.js'
import { updateDocs } from './docs.js'

export const updateLeaderboardAdminRoute = adminRoute({
  method: 'put',
  path: '/:id',
  docs: updateDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the leaderboard' }),
    }),
    body: updateLeaderboardBodySchema(z),
  }),
  middleware: withMiddleware(
    requireAdminScopes([AdminAPIKeyScope.WRITE_LEADERBOARDS]),
    loadLeaderboard,
  ),
  handler: (ctx) =>
    updateLeaderboardHandler({
      em: ctx.em,
      leaderboard: ctx.state.leaderboard,
      body: ctx.state.validated.body,
      actor: ctx.state.key,
    }),
})
