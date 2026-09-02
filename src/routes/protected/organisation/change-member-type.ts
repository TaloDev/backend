import OrganisationMember from '../../../entities/organisation-member.js'
import { UserType } from '../../../entities/user.js'
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

    const membership = await em
      .repo(OrganisationMember)
      .findOne({ user: userId, organisation: caller.organisation }, { populate: ['user'] })
    if (!membership) {
      return ctx.throw(404, 'User not found')
    }
    const target = membership.user

    membership.type = type
    if (target.organisation.id === caller.organisation.id) {
      target.type = type
    }
    await em.persist([membership, target]).flush()

    return {
      status: 200,
      body: {
        user: target,
      },
    }
  },
})
