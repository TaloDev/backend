import Stripe from 'stripe'
import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Service, Request, Response, Routes, Validate } from 'koa-clay'
import PricingPlan from '../entities/pricing-plan'
import BillingPolicy from '../policies/billing.policy'
import User from '../entities/user'
import OrganisationPricingPlan from '../entities/organisation-pricing-plan'
import PricingPlanAction, { PricingPlanActionType } from '../entities/pricing-plan-action'
import Organisation from '../entities/organisation'
import Invite from '../entities/invite'
import { isSameDay } from 'date-fns'
import initStripe from '../lib/billing/initStripe'
import getUserFromToken from '../lib/auth/getUserFromToken'
import OrganisationPricingPlanAction from '../entities/organisation-pricing-plan-action'
import { isSameMonth } from 'date-fns'

const stripe = initStripe()

type PricingPlanProduct = PricingPlan & {
  name: string,
  prices: {
    currency: string
    amount: number,
    interval: Stripe.Price.Recurring.Interval,
    current: boolean
  }[]
}

type PricingPlanUsage = {
  [key: string]: {
    limit: number
    used: number
  }
}

@Routes([
  {
    method: 'GET',
    path: '/plans',
    handler: 'plans'
  },
  {
    method: 'POST',
    path: '/checkout-session',
    handler: 'createCheckoutSession'
  },
  {
    method: 'POST',
    path: '/confirm-plan',
    handler: 'confirmPlan'
  },
  {
    method: 'POST',
    path: '/portal-session',
    handler: 'createPortalSession'
  },
  {
    method: 'GET',
    path: '/usage',
    handler: 'usage'
  },
  {
    method: 'GET',
    path: '/organisation-plan',
    handler: 'organisationPlan'
  }
])
export default class BillingService implements Service {
  async plans(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const plans = await em.getRepository(PricingPlan).findAll({ populate: ['actions'] })

    const pricingPlanProducts: PricingPlanProduct[] = []
    const user = await getUserFromToken(req.ctx)
    const organisation: Organisation = user.organisation

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
          amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring.interval,
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

  private async checkCanDowngrade(em: EntityManager, req: Request, newPlan: PricingPlan): Promise<void> {
    await newPlan.actions.loadItems()
    const planUserLimit = newPlan.actions.getItems().find((action) => action.type === PricingPlanActionType.USER_INVITE)?.limit ?? Infinity

    const organisation: Organisation = req.ctx.state.user.organisation
    const members = await em.getRepository(User).find({ organisation })
    const pendingInvites = await em.getRepository(Invite).find({ organisation })

    if (members.length > planUserLimit) {
      req.ctx.throw(400, 'You cannot downgrade your plan while your organisation has more users than the new plan\'s user limit. Please contact support about removing users.')
    } else if (members.length + pendingInvites.length > planUserLimit) {
      req.ctx.throw(400, 'You cannot downgrade your plan while your organisation has pending invites that would take the organisation\'s user count above new plan\'s user limit. Please contact support about removing users.')
    }
  }

  async previewPlan(req: Request, price: string): Promise<Response> {
    const prorationDate = Math.floor(Date.now() / 1000)

    const organisation: Organisation = req.ctx.state.user.organisation
    const subscriptions = await stripe.subscriptions.list({ customer: organisation.pricingPlan.stripeCustomerId  })
    const subscription = subscriptions.data[0]

    const items = [{
      id: subscription.items.data[0].id,
      price
    }]

    const invoice = await stripe.invoices.retrieveUpcoming({
      customer: organisation.pricingPlan.stripeCustomerId,
      subscription: subscription.id,
      subscription_items: items,
      subscription_proration_date: prorationDate
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

  async getPrice(req: Request): Promise<string> {
    const { pricingPlanId, pricingInterval } = req.body
    const em: EntityManager = req.ctx.em

    const plan = await em.getRepository(PricingPlan).findOne(pricingPlanId)
    if (!plan) req.ctx.throw(404, 'Pricing plan not found')

    await this.checkCanDowngrade(em, req, plan)

    const prices = await stripe.prices.list({
      product: plan.stripeId,
      active: true,
      expand: ['data.product']
    })

    return prices.data.find((p) => p.recurring.interval === pricingInterval).id
  }

  @Validate({ body: ['pricingPlanId', 'pricingInterval'] })
  @HasPermission(BillingPolicy, 'createCheckoutSession')
  async createCheckoutSession(req: Request): Promise<Response> {
    const { pricingPlanId } = req.body
    const em: EntityManager = req.ctx.em

    const price = await this.getPrice(req)

    const organisation: Organisation = req.ctx.state.user.organisation
    if (organisation.pricingPlan.stripeCustomerId) {
      return await this.previewPlan(req, price)
    }

    const orgPlan = await em.getRepository(OrganisationPricingPlan).findOne({ organisation })

    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [{
        price,
        quantity: 1
      }],
      mode: 'subscription',
      customer: orgPlan.stripeCustomerId ?? (await stripe.customers.create()).id,
      success_url: `${process.env.DASHBOARD_URL}/billing?new_plan=${pricingPlanId}`,
      cancel_url: `${process.env.DASHBOARD_URL}/billing`
    })

    orgPlan.stripeCustomerId = session.customer as string
    await em.flush()

    return {
      status: 200,
      body: {
        redirect: session.url
      }
    }
  }

  @Validate({ body: ['prorationDate', 'pricingPlanId', 'pricingInterval'] })
  @HasPermission(BillingPolicy, 'confirmPlan')
  async confirmPlan(req: Request): Promise<Response> {
    const { prorationDate } = req.body

    if (!isSameDay(new Date(), new Date(prorationDate * 1000))) req.ctx.throw(400)

    const price = await this.getPrice(req)

    const organisation: Organisation = req.ctx.state.user.organisation
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
      status: 200
    }
  }

  @HasPermission(BillingPolicy, 'createPortalSession')
  async createPortalSession(req: Request): Promise<Response> {
    const stripeCustomerId = (req.ctx.state.user as User).organisation.pricingPlan.stripeCustomerId

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

  @HasPermission(BillingPolicy, 'usage')
  async usage(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const organisation: Organisation = req.ctx.state.user.organisation
    await organisation.pricingPlan.pricingPlan.actions.loadItems()

    const usage: PricingPlanUsage = {}
    const orgActions = await em.getRepository(OrganisationPricingPlanAction).find({ organisationPricingPlan: organisation.pricingPlan })

    for (const planAction of organisation.pricingPlan.pricingPlan.actions.getItems()) {
      const orgActionsForType = orgActions.filter((orgAction) => orgAction.type === planAction.type)

      if (PricingPlanAction.isTypeTrackedMonthly(planAction.type)) {
        usage[planAction.type] = {
          limit: planAction.limit,
          used: orgActionsForType.filter((orgAction) => isSameMonth(new Date(), orgAction.createdAt)).length
        }
      } else {
        usage[planAction.type] = {
          limit: planAction.limit,
          used: orgActionsForType.length
        }
      }
    }

    return {
      status: 200,
      body: {
        usage
      }
    }
  }

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
