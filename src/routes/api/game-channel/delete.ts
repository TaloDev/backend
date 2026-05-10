import { APIKeyScope } from '../../../entities/api-key.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { deleteChannelHandler } from '../../protected/game-channel/delete.js'
import { loadChannel, canModifyChannel } from './common.js'
import { deleteDocs } from './docs.js'

export const deleteRoute = apiRoute({
  method: 'delete',
  path: '/:id',
  docs: deleteDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the channel' }),
    }),
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_GAME_CHANNELS]),
    loadAlias,
    loadChannel,
  ),
  handler: async (ctx) => {
    const channel = ctx.state.channel

    if (!canModifyChannel(channel, ctx.state.alias)) {
      return ctx.throw(403, 'This player is not the owner of the channel')
    }

    return deleteChannelHandler({
      em: ctx.em,
      channel,
      wss: ctx.wss,
      forwarded: true,
    })
  },
})
