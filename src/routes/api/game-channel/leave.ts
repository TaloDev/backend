import { APIKeyScope } from '../../../entities/api-key.js'
import { GameChannelLeavingReason } from '../../../entities/game-channel.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { loadChannel } from './common.js'
import { leaveDocs } from './docs.js'

export const leaveRoute = apiRoute({
  method: 'post',
  path: '/:id/leave',
  docs: leaveDocs,
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
    const em = ctx.em
    const channel = ctx.state.channel
    const playerAlias = ctx.state.alias

    if (channel.hasMember(playerAlias.id)) {
      const deleted = await channel.removeMember({
        socket: ctx.wss,
        playerAlias,
        reason: GameChannelLeavingReason.DEFAULT,
      })

      if (deleted) {
        await em.remove(channel).flush()
      } else {
        await em.flush()
      }
    }

    return {
      status: 204,
    }
  },
})
