import { APIKeyScope } from '../../../entities/api-key.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { entriesQuerySchema } from '../../../lib/validation/routes/leaderboards/entriesQuerySchema.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { listEntriesHandler } from '../../protected/leaderboard/entries.js'
import { loadLeaderboard } from './common.js'
import { getDocs } from './docs.js'

export const getRoute = apiRoute({
  method: 'get',
  path: '/:internalName/entries',
  docs: getDocs,
  schema: (z) => ({
    route: z.object({
      internalName: z.string().meta({ description: 'The internal name of the leaderboard' }),
    }),
    query: entriesQuerySchema,
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_LEADERBOARDS]), loadLeaderboard),
  handler: async (ctx) => {
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
      forwarded: true,
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
