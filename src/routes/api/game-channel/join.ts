import { APIKeyScope } from '../../../entities/api-key.js'
import GameChannel from '../../../entities/game-channel.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { loadChannel, joinChannel } from './common.js'
import { joinDocs } from './docs.js'

export const joinRoute = apiRoute({
  method: 'post',
  path: '/:id/join',
  docs: joinDocs,
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

    if (channel.private) {
      return ctx.throw(403, 'This channel is private')
    }

    await joinChannel({
      em: ctx.em,
      wss: ctx.wss,
      channel,
      playerAlias: ctx.state.alias,
    })

    const counts = await GameChannel.getManyCounts({
      em: ctx.em,
      channelIds: [channel.id],
      includeDevData: ctx.state.includeDevData,
    })

    return {
      status: 200,
      body: {
        channel: channel.toJSONWithCount(counts),
      },
    }
  },
})
