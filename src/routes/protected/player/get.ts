import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { loadPlayer } from './common'

export const getRoute = protectedRoute({
  method: 'get',
  path: '/:id',
  middleware: withMiddleware(loadGame, loadPlayer),
  handler: async (ctx) => {
    const player = ctx.state.player
    await player.props.loadItems()

    return {
      status: 200,
      body: {
        player
      }
    }
  }
})
