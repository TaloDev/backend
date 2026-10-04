import type Player from '../../../entities/player.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { loadPlayer } from './common.js'

export async function getPlayerHandler({ player }: { player: Player }) {
  await player.props.loadItems()

  return {
    status: 200,
    body: {
      player,
    },
  }
}

export const getRoute = protectedRoute({
  method: 'get',
  path: '/:id',
  middleware: withMiddleware(loadGame, loadPlayer),
  handler: (ctx) => getPlayerHandler({ player: ctx.state.player }),
})
