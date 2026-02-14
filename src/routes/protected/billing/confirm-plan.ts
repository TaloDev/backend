import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { ownerGate } from '../../../middleware/policy-middleware'
import { requireStripe, getPrice } from './common'
import { isSameHour } from 'date-fns'

export const confirmPlanRoute = protectedRoute({
  method: 'post',
  path: '/confirm-plan',
  schema: (z) => ({
    body: z.object({
      prorationDate: z.number(),
      pricingPlanId: z.number(),
      pricingInterval: z.enum(['month', 'year'])
    })
  }),
  middleware: withMiddleware(requireStripe, ownerGate('update the organisation pricing plan')),
  handler: async (ctx) => {
    const stripe = ctx.state.stripe

    const { prorationDate, pricingPlanId, pricingInterval } = ctx.state.validated.body
    if (!isSameHour(new Date(), new Date(prorationDate * 1000))) {
      return ctx.throw(400)
    }

    const organisation = ctx.state.user.organisation
    const stripeCustomerId = organisation.pricingPlan.stripeCustomerId
    // should already be on a plan before preview/confirming another
    if (!stripeCustomerId) {
      return ctx.throw(400)
    }

    const price = await getPrice(ctx, pricingPlanId, pricingInterval)

    const subscriptions = await stripe.subscriptions.list({ customer: stripeCustomerId })
    const subscription = subscriptions.data[0]

    await stripe.subscriptions.update(
      subscription.id,
      {
        items: [{
          id: subscription.items.data[0].id,
          price
        }],
        proration_date: prorationDate,
        cancel_at_period_end: false
      }
    )

    return {
      status: 204
    }
  }
})
