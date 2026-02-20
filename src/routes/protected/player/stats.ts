import PlayerGameStat from '../../../entities/player-game-stat'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { loadPlayer } from './common'

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
