import { getPlayerUsageBreakdown } from '../../../lib/billing/getPlayerUsageBreakdown.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { ownerGate } from '../../../middleware/policy-middleware.js'

export const usageRoute = protectedRoute({
  method: 'get',
  path: '/usage',
  middleware: withMiddleware(ownerGate('view the organisation pricing plan usage')),
  handler: async (ctx) => {
    const em = ctx.em

    const organisation = ctx.state.user.organisation
    const playerLimit = organisation.pricingPlan.pricingPlan.playerLimit
    const { live, dev, deleted } = await getPlayerUsageBreakdown(em, organisation)

    return {
      status: 200,
      body: {
        usage: {
          limit: playerLimit,
          used: live + dev + deleted,
        },
        breakdown: {
          live,
          dev,
          deleted,
        },
      },
    }
  },
})
