import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import Invite from '../../../entities/invite'

export const listRoute = protectedRoute({
  method: 'get',
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'view invites')),
  handler: async (ctx) => {
    const em = ctx.em
    const invites = await em.repo(Invite).find({
      organisation: ctx.state.authenticatedUser.organisation
    })

    return {
      status: 200,
      body: {
        invites
      }
    }
  }
})
