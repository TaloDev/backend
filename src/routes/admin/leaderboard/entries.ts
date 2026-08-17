import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { entriesQuerySchema } from '../../../lib/validation/routes/leaderboards/entriesQuerySchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { listEntriesHandler } from '../../protected/leaderboard/entries.js'
import { loadLeaderboard } from './common.js'
import { entriesDocs } from './docs.js'

export const listEntriesAdminRoute = adminRoute({
  method: 'get',
  path: '/:id/entries',
  docs: entriesDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the leaderboard' }),
    }),
    query: entriesQuerySchema,
  }),
  middleware: withMiddleware(
    requireAdminScopes([AdminAPIKeyScope.READ_LEADERBOARDS]),
    loadLeaderboard,
  ),
  handler: (ctx) => {
    const {
      page,
      aliasId,
      withDeleted,
      propKey,
      propValue,
      startDate,
      endDate,
      aliasService,
      playerId,
    } = ctx.state.validated.query

    return listEntriesHandler({
      em: ctx.em,
      leaderboard: ctx.state.leaderboard,
      includeDevData: ctx.state.includeDevData,
      page,
      aliasId,
      withDeleted,
      propKey,
      propValue,
      startDate,
      endDate,
      aliasService,
      playerId,
    })
  },
})
