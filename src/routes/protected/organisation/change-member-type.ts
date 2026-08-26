import { UserType } from '../../../entities/user.js'
import User from '../../../entities/user.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { ownerGate, requireEmailConfirmed } from '../../../middleware/policy-middleware.js'

export const changeMemberTypeRoute = protectedRoute({
  method: 'patch',
  path: '/members/:userId',
  schema: (z) => ({
    route: z.object({
      userId: z.coerce.number().int().positive(),
    }),
    body: z.object({
      type: z.enum(UserType).refine((val) => [UserType.ADMIN, UserType.DEV].includes(val), {
        error: 'User type must be admin or developer',
      }),
    }),
  }),
  middleware: withMiddleware(
    ownerGate('change member user types'),
    requireEmailConfirmed('change member user types'),
  ),
  handler: async (ctx) => {
    const { userId } = ctx.state.validated.route
    const { type } = ctx.state.validated.body
    const em = ctx.em
    const caller = ctx.state.user

    if (userId === caller.id) {
      return ctx.throw(403, 'You cannot change your own user type')
    }

    const target = await em.repo(User).findOne({ id: userId, organisation: caller.organisation })
    if (!target) {
      return ctx.throw(404, 'User not found')
    }

    target.type = type
    await em.persist(target).flush()

    return {
      status: 200,
      body: {
        user: target,
      },
    }
  },
})
