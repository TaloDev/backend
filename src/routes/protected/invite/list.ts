import Invite from '../../../entities/invite.js'
import { UserType } from '../../../entities/user.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'

export const listRoute = protectedRoute({
  method: 'get',
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'view invites')),
  handler: async (ctx) => {
    const em = ctx.em
    const invites = await em.repo(Invite).find({
      organisation: ctx.state.user.organisation,
    })

    return {
      status: 200,
      body: {
        invites,
      },
    }
  },
})
