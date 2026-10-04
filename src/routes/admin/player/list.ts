import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { pageSchema } from '../../../lib/validation/pageSchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { listPlayersHandler } from '../../protected/player/list.js'
import { listDocs } from './docs.js'

export const listPlayersAdminRoute = adminRoute({
  method: 'get',
  docs: listDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-include-dev-data': z
        .string()
        .optional()
        .meta({ description: 'Set to 1 to include dev build players' }),
    }),
    query: z.object({
      search: z
        .string()
        .optional()
        .meta({ description: 'Search by player ID, prop value or alias identifier' }),
      page: pageSchema,
    }),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.READ_PLAYERS])),
  handler: (ctx) => {
    const { search, page } = ctx.state.validated.query

    return listPlayersHandler({
      em: ctx.em,
      game: ctx.state.game,
      search,
      page,
      includeDevData: ctx.state.includeDevData,
    })
  },
})
