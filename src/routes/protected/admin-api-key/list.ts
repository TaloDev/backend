import AdminAPIKey from '../../../entities/admin-api-key.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'

export const listRoute = protectedRoute({
  method: 'get',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const em = ctx.em
    const apiKeys = await em
      .repo(AdminAPIKey)
      .find({ game: ctx.state.game, revokedAt: null }, { populate: ['createdByUser'] })

    return {
      status: 200,
      body: {
        apiKeys,
      },
    }
  },
})
