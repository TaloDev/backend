import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import LeaderboardEntry from '../../../entities/leaderboard-entry.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { updateLeaderboardEntryBodySchema } from '../../../lib/validation/routes/leaderboards/updateLeaderboardEntryBodySchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { updateLeaderboardEntryHandler } from '../../protected/leaderboard/update-entry.js'
import { loadLeaderboard } from './common.js'
import { updateEntryDocs } from './docs.js'

export const updateLeaderboardEntryAdminRoute = adminRoute({
  method: 'patch',
  path: '/:id/entries/:entryId',
  docs: updateEntryDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the leaderboard' }),
      entryId: numericStringSchema.meta({ description: 'The ID of the leaderboard entry' }),
    }),
    body: updateLeaderboardEntryBodySchema,
  }),
  middleware: withMiddleware(
    requireAdminScopes([AdminAPIKeyScope.WRITE_LEADERBOARDS]),
    loadLeaderboard,
  ),
  handler: async (ctx) => {
    const { entryId } = ctx.state.validated.route

    const entry = await ctx.em.repo(LeaderboardEntry).findOne({
      id: entryId,
      leaderboard: ctx.state.leaderboard,
    })

    if (!entry) {
      return ctx.throw(404, 'Leaderboard entry not found')
    }

    return updateLeaderboardEntryHandler({
      em: ctx.em,
      entry,
      body: ctx.state.validated.body,
      actor: ctx.state.key,
    })
  },
})
