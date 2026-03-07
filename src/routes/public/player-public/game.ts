import { publicRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGameFromToken } from './common'

export const gameRoute = publicRoute({
  method: 'get',
  path: '/game',
  middleware: withMiddleware(loadGameFromToken),
  handler: async (ctx) => {
    const { game } = ctx.state

    return {
      status: 200,
      body: {
        game: {
          name: game.name,
        },
      },
    }
  },
})
