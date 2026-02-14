import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { loadChannel, canModifyChannel, joinChannel } from './common'
import PlayerAlias from '../../../entities/player-alias'
import { inviteDocs } from './docs'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'

export const inviteRoute = apiRoute({
  method: 'post',
  path: '/:id/invite',
  docs: inviteDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the channel' })
    }),
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema
    }),
    body: z.object({
      inviteeAliasId: z.number().meta({ description: 'The ID of the player alias to invite' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_GAME_CHANNELS]),
    loadAlias,
    loadChannel
  ),
  handler: async (ctx) => {
    const { inviteeAliasId } = ctx.state.validated.body
    const em = ctx.em
    const channel = ctx.state.channel

    if (!canModifyChannel(channel, ctx.state.alias)) {
      return ctx.throw(403, 'This player is not the owner of the channel')
    }

    const inviteeAlias = await em.getRepository(PlayerAlias).findOne({
      id: inviteeAliasId,
      player: {
        game: ctx.state.game
      }
    })

    if (!inviteeAlias) {
      return ctx.throw(404, 'Invitee not found')
    }

    if (inviteeAlias.id === ctx.state.alias.id) {
      return ctx.throw(400, 'Players cannot invite themselves')
    }

    await joinChannel(em, ctx.wss, channel, inviteeAlias)

    return {
      status: 204
    }
  }
})
