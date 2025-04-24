import Stripe from 'stripe'
import { EntityManager } from '@mikro-orm/mysql'
import { Request, Response, Route, Service } from 'koa-clay'
import OrganisationPricingPlan from '../../entities/organisation-pricing-plan'
import createDefaultPricingPlan from '../../lib/billing/createDefaultPricingPlan'
import PricingPlan from '../../entities/pricing-plan'
import * as Sentry from '@sentry/node'
import { Request as KoaRequest } from 'koa'
import initStripe from '../../lib/billing/initStripe'
import PlanCancelled from '../../emails/plan-cancelled-mail'
import PlanRenewed from '../../emails/plan-renewed-mail'
import PlanUpgraded from '../../emails/plan-upgraded-mail'
import PlanInvoice from '../../emails/plan-invoice-mail'
import queueEmail from '../../lib/messaging/queueEmail'
import PlanPaymentFailed from '../../emails/plan-payment-failed'

type RawRequest = KoaRequest & {
  rawBody: Buffer
}

const stripe = initStripe()

export default class WebhookService extends Service {
  @Route({
    method: 'POST',
    path: '/subscriptions'
  })
  async subscriptions(req: Request): Promise<Response> {
    let event: Stripe.Event

    try {
      event = stripe!.webhooks.constructEvent(
        (req.ctx.request as RawRequest).rawBody,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    /* v8 ignore start */
    } catch (err) {
      Sentry.captureException(err)
      req.ctx.throw(401)
    }
    /* v8 ignore stop */

    switch (event.type) {
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(req, event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(req, event.data.object as Stripe.Subscription)
        break
      case 'invoice.finalized':
        await this.handleNewInvoice(req, event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(req, event.data.object as Stripe.Invoice)
        break
    }

    return {
      status: 200
    }
  }

  private async getOrganisationPricingPlan(req: Request, stripeCustomerId: string): Promise<OrganisationPricingPlan> {
    const em: EntityManager = req.ctx.em

    const orgPlan = await em.getRepository(OrganisationPricingPlan).findOneOrFail({
      stripeCustomerId
    }, {
      populate: ['organisation']
    })

    return orgPlan
  }

  private async handleSubscriptionDeleted(req: Request, subscription: Stripe.Subscription) {
    const em: EntityManager = req.ctx.em

    const orgPlan = await this.getOrganisationPricingPlan(req, subscription.customer as string)
    orgPlan.organisation.pricingPlan = await createDefaultPricingPlan(em, orgPlan.organisation)

    await em.flush()
  }

  private async handleSubscriptionUpdated(req: Request, subscription: Stripe.Subscription) {
    const em: EntityManager = req.ctx.em

    const orgPlan = await this.getOrganisationPricingPlan(req, subscription.customer as string)

    const price = subscription.items.data[0].price
    const plan = await em.getRepository(PricingPlan).findOneOrFail({ stripeId: price.product as string })

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
      await queueEmail(req.ctx.emailQueue, new PlanUpgraded(orgPlan.organisation, price, product))
    }

    if (prevEndDate && !orgPlan.endDate && prevStripePriceId === orgPlan.stripePriceId) {
      await queueEmail(req.ctx.emailQueue, new PlanRenewed(orgPlan.organisation))
    } else if (!prevEndDate && orgPlan.endDate) {
      await queueEmail(req.ctx.emailQueue, new PlanCancelled(orgPlan.organisation))
    }
  }

  private async handleNewInvoice(req: Request, invoice: Stripe.Invoice): Promise<void> {
    const orgPlan = await this.getOrganisationPricingPlan(req, invoice.customer as string)
    await queueEmail(req.ctx.emailQueue, new PlanInvoice(orgPlan.organisation, invoice))
  }

  private async handlePaymentFailed(req: Request, invoice: Stripe.Invoice): Promise<void> {
    const orgPlan = await this.getOrganisationPricingPlan(req, invoice.customer as string)
    await queueEmail(req.ctx.emailQueue, new PlanPaymentFailed(orgPlan.organisation, invoice))
  }
}
