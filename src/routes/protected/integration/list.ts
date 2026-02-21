import Integration from '../../../entities/integration'
import { UserType } from '../../../entities/user'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'

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
