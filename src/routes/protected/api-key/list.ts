import APIKey from '../../../entities/api-key.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { createToken } from './common.js'

export const listRoute = protectedRoute({
  method: 'get',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const em = ctx.em
    const apiKeys = await em
      .repo(APIKey)
      .find({ game: ctx.state.game, revokedAt: null }, { populate: ['createdByUser'] })

    const apiKeysWithEnding = await Promise.all(
      apiKeys.map(async (apiKey) => {
        const token = await createToken(em, apiKey)
        return { ...apiKey.toJSON(), keyEnding: token.slice(-4) }
      }),
    )

    return {
      status: 200,
      body: {
        apiKeys: apiKeysWithEnding,
      },
    }
  },
})
