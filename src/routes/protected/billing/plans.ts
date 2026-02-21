import assert from 'node:assert'
import Stripe from 'stripe'
import PricingPlan from '../../../entities/pricing-plan'
import initStripe from '../../../lib/billing/initStripe'
import { protectedRoute } from '../../../lib/routing/router'

type PricingPlanProduct = Omit<
  PricingPlan & {
    name: string
    prices: {
      currency: string
      amount: number
      interval: Stripe.Price.Recurring.Interval
      current: boolean
    }[]
  },
  'toJSON'
>

export const plansRoute = protectedRoute({
  method: 'get',
  path: '/plans',
  handler: async (ctx) => {
    const stripe = initStripe()
    if (!stripe) {
      return {
        status: 200,
        body: {
          pricingPlans: [],
        },
      }
    }

    const em = ctx.em
    const plans = await em.repo(PricingPlan).find({ hidden: false })

    const pricingPlanProducts: PricingPlanProduct[] = []
    const organisation = ctx.state.user.organisation

    for (const plan of plans) {
      const prices = await stripe.prices.list({
        product: plan.stripeId,
        active: true,
        expand: ['data.product'],
      })

      pricingPlanProducts.push({
        ...plan,
        name: (prices.data[0].product as Stripe.Product).name,
        prices: prices.data.map((price) => {
          assert(price.recurring, 'Price must be recurring')
          assert(price.unit_amount !== null, 'Price must have an amount')

          return {
            amount: price.unit_amount,
            currency: price.currency,
            interval: price.recurring.interval,
            current: price.id === organisation.pricingPlan.stripePriceId,
          }
        }),
      })
    }

    return {
      status: 200,
      body: {
        pricingPlans: pricingPlanProducts,
      },
    }
  },
})
