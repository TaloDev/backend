import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { deleteChannelHandler } from '../../protected/game-channel/delete.js'
import { loadChannel } from './common.js'
import { deleteDocs } from './docs.js'

export const deleteChannelAdminRoute = adminRoute({
  method: 'delete',
  path: '/:id',
  docs: deleteDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the channel' }),
    }),
  }),
  middleware: withMiddleware(
    requireAdminScopes([AdminAPIKeyScope.WRITE_GAME_CHANNELS]),
    loadChannel,
  ),
  handler: (ctx) =>
    deleteChannelHandler({
      em: ctx.em,
      channel: ctx.state.channel,
      wss: ctx.wss,
      actor: ctx.state.key,
    }),
})
