import GameSecret from '../../../entities/game-secret.js'
import Game from '../../../entities/game.js'
import { UserType } from '../../../entities/user.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: z.object({
      name: z.string(),
    }),
  }),
  middleware: withMiddleware(userTypeGate([UserType.ADMIN, UserType.DEV], 'create games')),
  handler: async (ctx) => {
    const { name } = ctx.state.validated.body
    const em = ctx.em

    const game = new Game(name, ctx.state.user.organisation)
    try {
      game.apiSecret = new GameSecret()
    } catch (err) {
      return ctx.throw(500, (err as Error).message)
    }
    await em.persist(game).flush()

    return {
      status: 200,
      body: {
        game,
      },
    }
  },
})
