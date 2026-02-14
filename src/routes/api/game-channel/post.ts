import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { createChannelHandler } from '../../protected/game-channel/create'
import { postDocs } from './docs'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { createPropsSchema } from '../../../lib/validation/propsSchema'

export const postRoute = apiRoute({
  method: 'post',
  docs: postDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema
    }),
    body: z.object({
      name: z.string().meta({ description: 'The name of the channel' }),
      props: createPropsSchema.optional().meta({ description: 'An array of @type(Props:prop)' }),
      autoCleanup: z.boolean().optional().meta({ description: 'Whether the channel should be automatically deleted when the owner leaves or the channel is empty (default is false)' }),
      private: z.boolean().optional().meta({ description: 'Private channels require invites to join them (default is false)' }),
      temporaryMembership: z.boolean().optional().meta({ description: 'Whether members should be removed when they disconnect (default is false)' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_GAME_CHANNELS]),
    loadAlias
  ),
  handler: async (ctx) => {
    const { name, props, autoCleanup, private: isPrivate, temporaryMembership } = ctx.state.validated.body

    return createChannelHandler({
      em: ctx.em,
      game: ctx.state.game,
      includeDevData: ctx.state.includeDevData,
      wss: ctx.wss,
      forwarded: true,
      alias: ctx.state.alias,
      name,
      props,
      autoCleanup,
      isPrivate,
      temporaryMembership
    })
  }
})
