import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'

export const getRoute = protectedRoute({
  method: 'get',
  middleware: withMiddleware(loadGame),
  handler: (ctx) => ({
    status: 200,
    body: {
      config: ctx.state.game.getLiveConfig(),
    },
  }),
})
