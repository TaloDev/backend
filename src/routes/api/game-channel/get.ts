import { APIKeyScope } from '../../../entities/api-key.js'
import GameChannel from '../../../entities/game-channel.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { loadChannel } from './common.js'
import { getDocs } from './docs.js'

export const getRoute = apiRoute({
  method: 'get',
  path: '/:id',
  docs: getDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the channel' }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_GAME_CHANNELS]), loadChannel),
  handler: async (ctx) => {
    const channel = ctx.state.channel

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
