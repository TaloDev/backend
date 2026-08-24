import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { listLeaderboardsHandler } from '../../protected/leaderboard/list.js'
import { listDocs } from './docs.js'

export const listLeaderboardsAdminRoute = adminRoute({
  method: 'get',
  docs: listDocs,
  schema: (z) => ({
    query: z.object({
      internalName: z.string().optional().meta({
        description: 'Filter leaderboards by internal name',
      }),
    }),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.READ_LEADERBOARDS])),
  handler: (ctx) => {
    const { internalName } = ctx.state.validated.query

    return listLeaderboardsHandler({
      em: ctx.em,
      game: ctx.state.game,
      internalName,
    })
  },
})
