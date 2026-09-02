import OrganisationMember from '../../../entities/organisation-member.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireEmailConfirmed } from '../../../middleware/policy-middleware.js'

export const switchOrganisationRoute = protectedRoute({
  method: 'post',
  path: '/switch',
  schema: (z) => ({
    body: z.object({
      organisationId: z.number().int().positive(),
    }),
  }),
  middleware: withMiddleware(requireEmailConfirmed('switch organisations')),
  handler: async (ctx) => {
    const { organisationId } = ctx.state.validated.body
    const em = ctx.em
    const user = ctx.state.user

    const membership = await em.repo(OrganisationMember).findOne({
      user,
      organisation: organisationId,
    })
    if (!membership) {
      return ctx.throw(404, 'Membership not found')
    }

    user.organisation = membership.organisation
    user.type = membership.type
    await em.persist(user).flush()

    return {
      status: 200,
      body: {
        user,
      },
    }
  },
})
