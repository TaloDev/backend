import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { updateChannelHandler } from '../../protected/game-channel/update.js'
import { updateChannelBodySchema } from '../../schemas/game-channels/updateChannelBodySchema.js'
import { loadChannel } from './common.js'
import { updateDocs } from './docs.js'

export const updateChannelAdminRoute = adminRoute({
  method: 'put',
  path: '/:id',
  docs: updateDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the channel' }),
    }),
    body: updateChannelBodySchema(z),
  }),
  middleware: withMiddleware(
    requireAdminScopes([AdminAPIKeyScope.WRITE_GAME_CHANNELS]),
    loadChannel,
  ),
  handler: (ctx) => {
    const {
      name,
      ownerAliasId,
      props,
      autoCleanup,
      private: isPrivate,
      temporaryMembership,
    } = ctx.state.validated.body

    return updateChannelHandler({
      em: ctx.em,
      channel: ctx.state.channel,
      includeDevData: ctx.state.includeDevData,
      wss: ctx.wss,
      actor: ctx.state.key,
      name,
      ownerAliasId,
      props,
      autoCleanup,
      isPrivate,
      temporaryMembership,
    })
  },
})
