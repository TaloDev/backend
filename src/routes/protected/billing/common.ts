import { EntityManager } from '@mikro-orm/mysql'
import { Next } from 'koa'
import assert from 'node:assert'
import Stripe from 'stripe'
import Organisation from '../../../entities/organisation'
import Player from '../../../entities/player'
import PricingPlan from '../../../entities/pricing-plan'
import initStripe from '../../../lib/billing/initStripe'
import { ProtectedRouteContext } from '../../../lib/routing/context'

type RequireStripeContext = ProtectedRouteContext<{ stripe: Stripe }>

export async function requireStripe(ctx: RequireStripeContext, next: Next) {
  const stripe = initStripe()
  if (!stripe) {
    return ctx.throw(405)
  }

  ctx.state.stripe = stripe
  await next()
}

export async function checkCanDowngrade(
  em: EntityManager,
  ctx: ProtectedRouteContext,
  newPlan: PricingPlan,
) {
  const planPlayerLimit = newPlan.playerLimit ?? Infinity

  const organisation: Organisation = ctx.state.user.organisation
  const playerCount = await em.repo(Player).count({
    game: { organisation },
  })

  if (playerCount >= planPlayerLimit) {
    return ctx.throw(
      400,
      'You cannot downgrade your plan because your organisation has reached its player limit.',
    )
  }
}

export async function getPrice(
  ctx: RequireStripeContext,
  pricingPlanId: number,
  pricingInterval: 'month' | 'year',
) {
  const em = ctx.em
  const stripe = ctx.state.stripe

  const plan = await em.repo(PricingPlan).findOne(pricingPlanId)
  if (!plan) {
    return ctx.throw(404, 'Pricing plan not found')
  }

  await checkCanDowngrade(em, ctx, plan)

  const prices = await stripe.prices.list({
    product: plan.stripeId,
    active: true,
    expand: ['data.product'],
  })

  const price = prices.data.find((p) => p.recurring?.interval === pricingInterval)
  assert(price)

  return price.id
}
