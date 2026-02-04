import { EntityManager } from '@mikro-orm/mysql'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { loadChannel } from './common'
import { GameChannelLeavingReason } from '../../../entities/game-channel'
import { leaveDocs } from './docs'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'

export const leaveRoute = apiRoute({
  method: 'post',
  path: '/:id/leave',
  docs: leaveDocs,
  schema: (z) => ({
    route: z.object({
      id: z.string().meta({ description: 'The ID of the channel' })
    }),
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_GAME_CHANNELS]),
    loadAlias,
    loadChannel
  ),
  handler: async (ctx) => {
    const em: EntityManager = ctx.em
    const channel = ctx.state.channel
    const playerAlias = ctx.state.alias

    if (channel.hasMember(playerAlias.id)) {
      await channel.sendMessageToMembers(ctx.wss, 'v1.channels.player-left', {
        channel,
        playerAlias,
        meta: {
          reason: GameChannelLeavingReason.DEFAULT
        }
      })

      if (channel.shouldAutoCleanup(playerAlias)) {
        await channel.sendDeletedMessage(ctx.wss)
        await em.remove(channel).flush()

        return {
          status: 204
        }
      }

      if (channel.owner?.id === playerAlias.id) {
        channel.owner = null
      }
      channel.members.remove(playerAlias)

      await em.flush()
    }

    return {
      status: 204
    }
  }
})
