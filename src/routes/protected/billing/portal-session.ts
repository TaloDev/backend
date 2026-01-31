import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { ownerGate } from '../../../middleware/policy-middleware'
import { requireStripe } from './common'

export const portalSessionRoute = protectedRoute({
  method: 'post',
  path: '/portal-session',
  middleware: withMiddleware(requireStripe, ownerGate('update the organisation pricing plan')),
  handler: async (ctx) => {
    const stripe = ctx.state.stripe

    const organisation = ctx.state.user.organisation
    const stripeCustomerId = organisation.pricingPlan.stripeCustomerId
    if (!stripeCustomerId) {
      return ctx.throw(400)
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.DASHBOARD_URL}/billing`
    })

    return {
      status: 200,
      body: {
        redirect: portalSession.url
      }
    }
  }
})
