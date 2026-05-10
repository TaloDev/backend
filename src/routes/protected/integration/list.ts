import Integration from '../../../entities/integration.js'
import { UserType } from '../../../entities/user.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'

export const listRoute = protectedRoute({
  method: 'get',
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'view integrations'), loadGame),
  handler: async (ctx) => {
    const em = ctx.em
    const integrations = await em.repo(Integration).find({ game: ctx.state.game })

    return {
      status: 200,
      body: {
        integrations,
      },
    }
  },
})
