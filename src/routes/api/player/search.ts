import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { listPlayersHandler } from '../../protected/player/list'
import { searchDocs } from './docs'

export const searchRoute = apiRoute({
  method: 'get',
  path: '/search',
  docs: searchDocs,
  schema: (z) => ({
    query: z.object({
      query: z.string({ error: 'query is missing from the request query' })
        .refine(
          (val) => val.trim().replaceAll('-', '').length > 0,
          { message: 'Query must be a non-empty string' }
        )
        .meta({ description: 'Search for players by IDs, prop values and alias identifiers' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYERS])
  ),
  handler: async (ctx) => {
    const { query } = ctx.state.validated.query

    return listPlayersHandler({
      em: ctx.em,
      game: ctx.state.game,
      search: query,
      page: 0,
      includeDevData: ctx.state.includeDevData,
      forwarded: true
    })
  }
})
