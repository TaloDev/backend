import APIKey from '../../../entities/api-key'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'

export const listRoute = protectedRoute({
  method: 'get',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const em = ctx.em
    const apiKeys = await em
      .repo(APIKey)
      .find({ game: ctx.state.game, revokedAt: null }, { populate: ['createdByUser'] })

    return {
      status: 200,
      body: {
        apiKeys,
      },
    }
  },
})
