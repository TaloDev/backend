import Stripe from 'stripe'
import { PublicRouteContext } from '../../../lib/routing/context'
import OrganisationPricingPlan from '../../../entities/organisation-pricing-plan'
import createDefaultPricingPlan from '../../../lib/billing/createDefaultPricingPlan'
import PricingPlan from '../../../entities/pricing-plan'
import { captureException } from '@sentry/node'
import initStripe from '../../../lib/billing/initStripe'
import PlanCancelled from '../../../emails/plan-cancelled-mail'
import PlanRenewed from '../../../emails/plan-renewed-mail'
import PlanUpgraded from '../../../emails/plan-upgraded-mail'
import PlanInvoice from '../../../emails/plan-invoice-mail'
import queueEmail from '../../../lib/messaging/queueEmail'
import PlanPaymentFailed from '../../../emails/plan-payment-failed'
import { getGlobalQueue } from '../../../config/global-queues'
import assert from 'node:assert'
import { publicRoute } from '../../../lib/routing/router'

const stripe = initStripe()

async function getOrganisationPricingPlan(
  ctx: PublicRouteContext,
  stripeCustomerId: string
): Promise<OrganisationPricingPlan> {
  const em = ctx.em

  const orgPlan = await em.repo(OrganisationPricingPlan).findOneOrFail({
    stripeCustomerId
  }, {
    populate: ['organisation']
  })

  return orgPlan
}

async function handleSubscriptionDeleted(
  ctx: PublicRouteContext,
  subscription: Stripe.Subscription
) {
  const em = ctx.em

  const orgPlan = await getOrganisationPricingPlan(ctx, subscription.customer as string)
  orgPlan.organisation.pricingPlan = await createDefaultPricingPlan(em, orgPlan.organisation)

  await em.flush()
}

async function handleSubscriptionUpdated(
  ctx: PublicRouteContext,
  subscription: Stripe.Subscription
) {
  const em = ctx.em

  const orgPlan = await getOrganisationPricingPlan(ctx, subscription.customer as string)

  const price = subscription.items.data[0].price
  const plan = await em.repo(PricingPlan).findOneOrFail({ stripeId: price.product as string })

  const prevEndDate = orgPlan.endDate
  const prevStripePriceId = orgPlan.stripePriceId

  orgPlan.pricingPlan = plan
  orgPlan.status = subscription.status
  orgPlan.stripePriceId = price.id
  orgPlan.endDate = subscription.cancel_at_period_end
    ? new Date(subscription.items.data[0].current_period_end * 1000)
    : null

  await em.flush()

  if (prevStripePriceId !== orgPlan.stripePriceId) {
    const price = subscription.items.data[0].price
    const product = await stripe!.products.retrieve(price.product as string)
    await queueEmail(getGlobalQueue('email'), new PlanUpgraded(orgPlan.organisation, price, product))
  }

  if (prevEndDate && !orgPlan.endDate && prevStripePriceId === orgPlan.stripePriceId) {
    await queueEmail(getGlobalQueue('email'), new PlanRenewed(orgPlan.organisation))
  } else if (!prevEndDate && orgPlan.endDate) {
    await queueEmail(getGlobalQueue('email'), new PlanCancelled(orgPlan.organisation))
  }
}

async function handleNewInvoice(
  ctx: PublicRouteContext,
  invoice: Stripe.Invoice
): Promise<void> {
  const orgPlan = await getOrganisationPricingPlan(ctx, invoice.customer as string)
  await queueEmail(getGlobalQueue('email'), new PlanInvoice(orgPlan.organisation, invoice))
}

async function handlePaymentFailed(
  ctx: PublicRouteContext,
  invoice: Stripe.Invoice
): Promise<void> {
  const orgPlan = await getOrganisationPricingPlan(ctx, invoice.customer as string)
  await queueEmail(getGlobalQueue('email'), new PlanPaymentFailed(orgPlan.organisation, invoice))
}

export const subscriptionsRoute = publicRoute({
  method: 'post',
  path: '/subscriptions',
  handler: async (ctx) => {
    assert(stripe)

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(
        ctx.request.rawBody,
        ctx.get('stripe-signature'),
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    /* v8 ignore start */
    } catch (err) {
      captureException(err)
      return ctx.throw(401)
    }
    /* v8 ignore stop */

    switch (event.type) {
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(ctx, event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(ctx, event.data.object as Stripe.Subscription)
        break
      case 'invoice.finalized':
        await handleNewInvoice(ctx, event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(ctx, event.data.object as Stripe.Invoice)
        break
    }

    return {
      status: 204
    }
  }
})
