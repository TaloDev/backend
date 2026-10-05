import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { pageSchema } from '../../../lib/validation/pageSchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { listChannelStorageHandler } from '../../protected/game-channel/storage.js'
import { loadChannel } from './common.js'
import { storageDocs } from './docs.js'

export const listChannelStorageAdminRoute = adminRoute({
  method: 'get',
  path: '/:id/storage',
  docs: storageDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the channel' }),
    }),
    query: z.object({
      search: z
        .string()
        .optional()
        .meta({ description: 'Search storage properties by key, value or alias identifier' }),
      page: pageSchema,
    }),
  }),
  middleware: withMiddleware(
    requireAdminScopes([AdminAPIKeyScope.READ_GAME_CHANNELS]),
    loadChannel,
  ),
  handler: (ctx) => {
    const { search, page } = ctx.state.validated.query

    return listChannelStorageHandler({
      em: ctx.em,
      channel: ctx.state.channel,
      search,
      page,
    })
  },
})
