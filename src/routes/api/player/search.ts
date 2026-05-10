import { APIKeyScope } from '../../../entities/api-key.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { listPlayersHandler } from '../../protected/player/list.js'
import { searchDocs } from './docs.js'

export const searchRoute = apiRoute({
  method: 'get',
  path: '/search',
  docs: searchDocs,
  schema: (z) => ({
    query: z.object({
      query: z
        .string({ error: 'query is missing from the request query' })
        .refine((val) => val.trim().replaceAll('-', '').length > 0, {
          message: 'Query must be a non-empty string',
        })
        .meta({ description: 'Search for players by IDs, prop values and alias identifiers' }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_PLAYERS])),
  handler: async (ctx) => {
    const { query } = ctx.state.validated.query

    return listPlayersHandler({
      em: ctx.em,
      game: ctx.state.game,
      search: query,
      page: 0,
      includeDevData: ctx.state.includeDevData,
      forwarded: true,
    })
  },
})
