import PlayerGameStat from '../../../entities/player-game-stat.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { loadPlayer } from './common.js'

export const statsRoute = protectedRoute({
  method: 'get',
  path: '/:id/stats',
  middleware: withMiddleware(loadGame, loadPlayer),
  handler: async (ctx) => {
    const em = ctx.em

    const stats = await em.repo(PlayerGameStat).find({
      player: ctx.state.player,
    })

    return {
      status: 200,
      body: {
        stats,
      },
    }
  },
})
