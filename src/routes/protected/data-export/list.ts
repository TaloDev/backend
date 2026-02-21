import DataExport from '../../../entities/data-export'
import { UserType } from '../../../entities/user'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'

export const listRoute = protectedRoute({
  method: 'get',
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'view data exports'), loadGame),
  handler: async (ctx) => {
    const em = ctx.em
    const dataExports = await em
      .repo(DataExport)
      .find({ game: ctx.state.game }, { populate: ['createdByUser'] })

    return {
      status: 200,
      body: {
        dataExports,
      },
    }
  },
})
