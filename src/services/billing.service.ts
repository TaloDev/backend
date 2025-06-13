import Stripe from 'stripe'
import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Route, Validate } from 'koa-clay'
import PricingPlan from '../entities/pricing-plan'
import BillingPolicy from '../policies/billing.policy'
import Organisation from '../entities/organisation'
import { isSameHour } from 'date-fns'
import initStripe from '../lib/billing/initStripe'
import getUserFromToken from '../lib/auth/getUserFromToken'
import Player from '../entities/player'
import getBillablePlayerCount from '../lib/billing/getBillablePlayerCount'
import { TraceService } from '../lib/routing/trace-service'

const stripe = initStripe()

type PricingPlanProduct = Omit<PricingPlan & {
  name: string
  prices: {
    currency: string
    amount: number
    interval: Stripe.Price.Recurring.Interval
    current: boolean
  }[]
}, 'toJSON'>

@TraceService()
export default class BillingService extends Service {
  @Route({
    method: 'GET',
    path: '/plans'
  })
  async plans(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const plans = await em.getRepository(PricingPlan).find({ hidden: false })

    const pricingPlanProducts: PricingPlanProduct[] = []
    const user = await getUserFromToken(req.ctx)
    const organisation: Organisation = user.organisation

    if (!stripe) {
      return {
        status: 200,
        body: {
          pricingPlans: []
        }
      }
    }

    for (const plan of plans) {
      const prices = await stripe.prices.list({
        product: plan.stripeId,
        active: true,
        expand: ['data.product']
      })

      pricingPlanProducts.push({
        ...plan,
        name: (prices.data[0].product as Stripe.Product).name,
        prices: prices.data.map((price) => ({
          /* v8 ignore next */
          amount: price.unit_amount ?? 0, // handle null case by defaulting to 0
          currency: price.currency,
          interval: price.recurring!.interval,
          current: price.id === organisation.pricingPlan.stripePriceId
        }))
      })
    }

    return {
      status: 200,
      body: {
        pricingPlans: pricingPlanProducts
      }
    }
  }

  async previewPlan(req: Request, price: string): Promise<Response> {
    /* v8 ignore next */
    if (!stripe) req.ctx.throw(405)

    const prorationDate = Math.floor(Date.now() / 1000)

    const organisation: Organisation = req.ctx.state.user.organisation
    const subscriptions = await stripe.subscriptions.list({ customer: organisation.pricingPlan.stripeCustomerId!  })
    const subscription = subscriptions.data[0]

    const items = [{
      id: subscription.items.data[0].id,
      price
    }]

    const invoice = await stripe.invoices.createPreview({
      customer: organisation.pricingPlan.stripeCustomerId!,
      subscription: subscription.id,
      subscription_details: {
        items,
        proration_date: prorationDate
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

  private async checkCanDowngrade(em: EntityManager, req: Request, newPlan: PricingPlan): Promise<void> {
    const planPlayerLimit = newPlan.playerLimit ?? Infinity

    const organisation: Organisation = req.ctx.state.user.organisation
    const playerCount = await em.getRepository(Player).count({
      game: { organisation }
    })

    if (playerCount >= planPlayerLimit) {
      req.ctx.throw(400, 'You cannot downgrade your plan because your organisation has reached its player limit.')
    }
  }

  async getPrice(req: Request): Promise<string> {
    const { pricingPlanId, pricingInterval } = req.body
    const em: EntityManager = req.ctx.em

    const plan = await em.getRepository(PricingPlan).findOne(pricingPlanId)
    if (!plan) req.ctx.throw(404, 'Pricing plan not found')

    await this.checkCanDowngrade(em, req, plan)

    const prices = await stripe!.prices.list({
      product: plan.stripeId,
      active: true,
      expand: ['data.product']
    })

    return prices.data.find((p) => p.recurring!.interval === pricingInterval)!.id
  }

  @Route({
    method: 'POST',
    path: '/checkout-session'
  })
  @Validate({ body: ['pricingPlanId', 'pricingInterval'] })
  @HasPermission(BillingPolicy, 'createCheckoutSession')
  async createCheckoutSession(req: Request): Promise<Response> {
    /* v8 ignore next */
    if (!stripe) req.ctx.throw(405)

    const { pricingPlanId } = req.body
    const em: EntityManager = req.ctx.em

    const price = await this.getPrice(req)

    const organisation: Organisation = req.ctx.state.user.organisation

    if (organisation.pricingPlan.stripeCustomerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: organisation.pricingPlan.stripeCustomerId,
        status: 'active'
      })

      // this comparison isn't needed in the real world, but the stripe mock doesn't correctly filter by customer
      if (subscriptions.data[0]?.customer === organisation.pricingPlan.stripeCustomerId) {
        return this.previewPlan(req, price)
      }
    }

    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [{
        price,
        quantity: 1
      }],
      mode: 'subscription',
      customer: organisation.pricingPlan.stripeCustomerId ?? (await stripe.customers.create()).id,
      success_url: `${process.env.DASHBOARD_URL}/billing?new_plan=${pricingPlanId}`,
      cancel_url: `${process.env.DASHBOARD_URL}/billing`
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

  @Route({
    method: 'POST',
    path: '/confirm-plan'
  })
  @Validate({ body: ['prorationDate', 'pricingPlanId', 'pricingInterval'] })
  @HasPermission(BillingPolicy, 'confirmPlan')
  async confirmPlan(req: Request): Promise<Response> {
    /* v8 ignore next */
    if (!stripe) req.ctx.throw(405)

    const { prorationDate } = req.body
    if (!isSameHour(new Date(), new Date(prorationDate * 1000))) req.ctx.throw(400)

    const organisation: Organisation = req.ctx.state.user.organisation
    if (!organisation.pricingPlan.stripeCustomerId) req.ctx.throw(400) // should already be on a plan before preview/confirming another

    const price = await this.getPrice(req)

    const subscriptions = await stripe.subscriptions.list({ customer: organisation.pricingPlan.stripeCustomerId  })
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

  @Route({
    method: 'POST',
    path: '/portal-session'
  })
  @HasPermission(BillingPolicy, 'createPortalSession')
  async createPortalSession(req: Request): Promise<Response> {
    /* v8 ignore next */
    if (!stripe) req.ctx.throw(405)

    const organisation: Organisation = req.ctx.state.user.organisation
    const stripeCustomerId = organisation.pricingPlan.stripeCustomerId

    if (!stripeCustomerId) req.ctx.throw(400)

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

  @Route({
    method: 'GET',
    path: '/usage'
  })
  @HasPermission(BillingPolicy, 'usage')
  async usage(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const organisation: Organisation = req.ctx.state.user.organisation
    const playerLimit = organisation.pricingPlan.pricingPlan.playerLimit
    const playerCount = await getBillablePlayerCount(em, organisation)

    return {
      status: 200,
      body: {
        usage: {
          limit: playerLimit,
          used: playerCount
        }
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/organisation-plan'
  })
  @HasPermission(BillingPolicy, 'organisationPlan')
  async organisationPlan(req: Request): Promise<Response> {
    const organisation: Organisation = req.ctx.state.user.organisation

    return {
      status: 200,
      body: {
        pricingPlan: organisation.pricingPlan
      }
    }
  }
}
