import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { ownerGate } from '../../../middleware/policy-middleware'

export const organisationPlanRoute = protectedRoute({
  method: 'get',
  path: '/organisation-plan',
  middleware: withMiddleware(ownerGate('view the organisation pricing plan')),
  handler: async (ctx) => {
    const organisation = ctx.state.user.organisation

    return {
      status: 200,
      body: {
        pricingPlan: organisation.pricingPlan,
      },
    }
  },
})
