import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { listChannelsHandler } from '../../protected/game-channel/list'
import { listDocs } from './docs'
import { pageSchema } from '../../../lib/validation/pageSchema'

export const listRoute = apiRoute({
  method: 'get',
  docs: listDocs,
  schema: (z) => ({
    query: z.object({
      page: pageSchema.meta({ description: 'The current pagination index (starting at 0)' }),
      search: z.string().optional().meta({ description: 'Search term to filter channels by name' }),
      propKey: z.string().optional().meta({ description: 'Only return channels with this prop key' }),
      propValue: z.string().optional().meta({ description: 'Only return channels with a matching prop key and value' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_CHANNELS])
  ),
  handler: async (ctx) => {
    const { search, page, propKey, propValue } = ctx.state.validated.query

    return listChannelsHandler({
      em: ctx.em,
      game: ctx.state.game,
      includeDevData: ctx.state.includeDevData,
      forwarded: true,
      search,
      page,
      propKey,
      propValue
    })
  }
})
