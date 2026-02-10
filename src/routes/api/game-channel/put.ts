import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { loadChannel, canModifyChannel } from './common'
import { updateChannelHandler } from '../../protected/game-channel/update'
import { putDocs } from './docs'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { updatePropsSchema } from '../../../lib/validation/propsSchema'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'

export const putRoute = apiRoute({
  method: 'put',
  path: '/:id',
  docs: putDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the channel' })
    }),
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema
    }),
    body: z.object({
      name: z.string().optional().meta({ description: 'The new name of the channel' }),
      props: updatePropsSchema.optional().meta({ description: 'An array of @type(Props:prop)' }),
      ownerAliasId: z.number().nullable().optional().meta({ description: 'The ID of the new owner of the channel' }),
      autoCleanup: z.boolean().optional().meta({ description: 'Whether the channel should be automatically deleted when the owner leaves or the channel is empty (default is false)' }),
      private: z.boolean().optional().meta({ description: 'Private channels require invites to join them (default is false)' }),
      temporaryMembership: z.boolean().optional().meta({ description: 'Whether members should be removed when they disconnect (default is false)' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_GAME_CHANNELS]),
    loadAlias,
    loadChannel
  ),
  handler: async (ctx) => {
    const channel = ctx.state.channel

    if (!canModifyChannel(channel, ctx.state.alias)) {
      ctx.throw(403, 'This player is not the owner of the channel')
    }

    const { name, props, ownerAliasId, autoCleanup, private: isPrivate, temporaryMembership } = ctx.state.validated.body

    return updateChannelHandler({
      em: ctx.em,
      channel,
      includeDevData: ctx.state.includeDevData,
      wss: ctx.wss,
      forwarded: true,
      name,
      ownerAliasId,
      props,
      autoCleanup,
      isPrivate,
      temporaryMembership
    })
  }
})
