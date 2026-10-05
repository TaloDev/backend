import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { pageSchema } from '../../../lib/validation/pageSchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { listChannelsHandler } from '../../protected/game-channel/list.js'
import { listDocs } from './docs.js'

export const listChannelsAdminRoute = adminRoute({
  method: 'get',
  docs: listDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-include-dev-data': z
        .string()
        .optional()
        .meta({ description: 'Set to 1 to include dev players in member counts' }),
    }),
    query: z.object({
      search: z.string().optional().meta({ description: 'Search channels by name or owner' }),
      page: pageSchema,
      propKey: z
        .string()
        .optional()
        .meta({ description: 'Only return channels with this prop key' }),
      propValue: z
        .string()
        .optional()
        .meta({ description: 'Only return channels with a matching prop key and value' }),
    }),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.READ_GAME_CHANNELS])),
  handler: (ctx) => {
    const { search, page, propKey, propValue } = ctx.state.validated.query

    return listChannelsHandler({
      em: ctx.em,
      game: ctx.state.game,
      includeDevData: ctx.state.includeDevData,
      search,
      page,
      propKey,
      propValue,
    })
  },
})
