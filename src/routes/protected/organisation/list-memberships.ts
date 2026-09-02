import OrganisationMember from '../../../entities/organisation-member.js'
import { protectedRoute } from '../../../lib/routing/router.js'

export const listMembershipsRoute = protectedRoute({
  method: 'get',
  path: '/memberships',
  handler: async (ctx) => {
    const memberships = await ctx.em.repo(OrganisationMember).find({
      user: ctx.state.user,
    })

    return {
      status: 200,
      body: {
        memberships,
      },
    }
  },
})
