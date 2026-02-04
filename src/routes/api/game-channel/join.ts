import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { loadChannel, joinChannel } from './common'
import { joinDocs } from './docs'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'

export const joinRoute = apiRoute({
  method: 'post',
  path: '/:id/join',
  docs: joinDocs,
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
    const channel = ctx.state.channel

    if (channel.private) {
      ctx.throw(403, 'This channel is private')
    }

    await joinChannel(ctx.em, ctx.wss, channel, ctx.state.alias)

    return {
      status: 200,
      body: {
        channel: await channel.toJSONWithCount(ctx.state.includeDevData)
      }
    }
  }
})
