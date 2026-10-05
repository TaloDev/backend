import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { createChannelHandler } from '../../protected/game-channel/create.js'
import { createChannelBodySchema } from '../../schemas/game-channels/createChannelBodySchema.js'
import { createDocs } from './docs.js'

export const createChannelAdminRoute = adminRoute({
  method: 'post',
  docs: createDocs,
  schema: (z) => ({
    body: createChannelBodySchema(z),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.WRITE_GAME_CHANNELS])),
  handler: (ctx) => {
    const {
      name,
      ownerAliasId,
      props,
      autoCleanup,
      private: isPrivate,
      temporaryMembership,
    } = ctx.state.validated.body

    return createChannelHandler({
      em: ctx.em,
      game: ctx.state.game,
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
