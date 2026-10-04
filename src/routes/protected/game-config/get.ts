import type Game from '../../../entities/game.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'

export function getLiveConfigHandler({ game }: { game: Game }) {
  return {
    status: 200,
    body: {
      config: game.getLiveConfig(),
    },
  }
}

export const getRoute = protectedRoute({
  method: 'get',
  middleware: withMiddleware(loadGame),
  handler: (ctx) => getLiveConfigHandler({ game: ctx.state.game }),
})
