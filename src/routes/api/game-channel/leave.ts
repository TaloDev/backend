import { APIKeyScope } from '../../../entities/api-key'
import { GameChannelLeavingReason } from '../../../entities/game-channel'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { requireScopes } from '../../../middleware/policy-middleware'
import { loadChannel } from './common'
import { leaveDocs } from './docs'

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
