import GameSave from '../../../entities/game-save.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { loadPlayer } from './common.js'

export const savesRoute = protectedRoute({
  method: 'get',
  path: '/:id/saves',
  middleware: withMiddleware(loadGame, loadPlayer),
  handler: async (ctx) => {
    const em = ctx.em

    const saves = await em.repo(GameSave).find({
      player: ctx.state.player,
    })

    return {
      status: 200,
      body: {
        saves,
      },
    }
  },
})
