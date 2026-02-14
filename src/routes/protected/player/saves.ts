import GameSave from '../../../entities/game-save'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { loadPlayer } from './common'

export const savesRoute = protectedRoute({
  method: 'get',
  path: '/:id/saves',
  middleware: withMiddleware(loadGame, loadPlayer),
  handler: async (ctx) => {
    const em = ctx.em

    const saves = await em.repo(GameSave).find({
      player: ctx.state.player
    })

    return {
      status: 200,
      body: {
        saves
      }
    }
  }
})
