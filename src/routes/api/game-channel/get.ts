import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadChannel } from './common'
import { getDocs } from './docs'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'

export const getRoute = apiRoute({
  method: 'get',
  path: '/:id',
  docs: getDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the channel' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_CHANNELS]),
    loadChannel
  ),
  handler: async (ctx) => {
    const channel = ctx.state.channel

    return {
      status: 200,
      body: {
        channel: await channel.toJSONWithCount(ctx.state.includeDevData)
      }
    }
  }
})
