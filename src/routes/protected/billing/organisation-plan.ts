import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { ownerGate } from '../../../middleware/policy-middleware.js'

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
