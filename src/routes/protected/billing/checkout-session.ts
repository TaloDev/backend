import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { ownerGate } from '../../../middleware/policy-middleware'
import { requireStripe, getPrice } from './common'

export const checkoutSessionRoute = protectedRoute({
  method: 'post',
  path: '/checkout-session',
  schema: (z) => ({
    body: z.object({
      pricingPlanId: z.number(),
      pricingInterval: z.enum(['month', 'year'])
    })
  }),
  middleware: withMiddleware(requireStripe, ownerGate('update the organisation pricing plan')),
  handler: async (ctx) => {
    const stripe = ctx.state.stripe
    const em = ctx.em

    const { pricingPlanId, pricingInterval } = ctx.state.validated.body

    const price = await getPrice(ctx, pricingPlanId, pricingInterval)

    const organisation = ctx.state.authenticatedUser.organisation

    if (organisation.pricingPlan.stripeCustomerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: organisation.pricingPlan.stripeCustomerId,
        status: 'active'
      })

      // this comparison isn't needed in the real world, but the stripe mock doesn't correctly filter by customer
      if (subscriptions.data[0]?.customer === organisation.pricingPlan.stripeCustomerId) {
        // preview plan instead
        const prorationDate = Math.floor(Date.now() / 1000)

        const subscription = subscriptions.data[0]

        const items = [{
          id: subscription.items.data[0].id,
          price
        }]

        const invoice = await stripe.invoices.createPreview({
          customer: organisation.pricingPlan.stripeCustomerId,
          subscription: subscription.id,
          subscription_details: {
            items,
            proration_date: prorationDate
          },
          automatic_tax: {
            enabled: true
          }
        })

        return {
          status: 200,
          body: {
            invoice: {
              lines: invoice.lines.data,
              total: invoice.total,
              collectionDate: invoice.period_end,
              prorationDate
            }
          }
        }
      }
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price,
        quantity: 1
      }],
      mode: 'subscription',
      customer: organisation.pricingPlan.stripeCustomerId ?? (await stripe.customers.create()).id,
      success_url: `${process.env.DASHBOARD_URL}/billing?new_plan=${pricingPlanId}`,
      cancel_url: `${process.env.DASHBOARD_URL}/billing`,
      automatic_tax: {
        enabled: true
      },
      customer_update: {
        address: 'auto'
      }
    })

    organisation.pricingPlan.stripeCustomerId = session.customer as string
    await em.flush()

    return {
      status: 200,
      body: {
        redirect: session.url
      }
    }
  }
})
