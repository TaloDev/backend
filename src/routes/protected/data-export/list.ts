import DataExport from '../../../entities/data-export.js'
import { UserType } from '../../../entities/user.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'

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
