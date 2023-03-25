import { EntityManager } from '@mikro-orm/core'
import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import initStripe from '../../../../src/lib/billing/initStripe'
import { v4 } from 'uuid'
import PricingPlanFactory from '../../../fixtures/PricingPlanFactory'
import SendGrid from '@sendgrid/mail'
import PlanUpgraded from '../../../../src/emails/plan-upgraded-mail'
import { addDays } from 'date-fns'
import PlanRenewed from '../../../../src/emails/plan-renewed-mail'
import PlanCancelled from '../../../../src/emails/plan-cancelled-mail'

const stripe = initStripe()

describe('Webhook service - subscription updated', () => {
  const sendMock = vi.spyOn(SendGrid, 'send')

  afterEach(() => {
    sendMock.mockClear()
  })

  it('should update the organisation pricing plan with the updated subscription\'s details', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const subscription = (await stripe.subscriptions.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = (subscription.customer as string) + organisation.id
    await (<EntityManager>global.em).flush()

    const payload = JSON.stringify({
      id: v4(),
      object: 'event',
      data: {
        object: {
          ...subscription,
          customer: organisation.pricingPlan.stripeCustomerId
        }
      },
      api_version: '2020-08-27',
      created: Date.now(),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'customer.subscription.updated'
    }, null, 2)

    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET
    })

    await request(global.app)
      .post('/public/webhooks/subscriptions')
      .set('stripe-signature', header)
      .send(payload)
      .expect(204)

    await (<EntityManager>global.em).refresh(organisation)
    const price = subscription.items.data[0].price
    expect(organisation.pricingPlan.stripePriceId).toBe(price.id)
    expect(sendMock).toHaveBeenCalledWith(new PlanUpgraded(organisation, price, product).getConfig())
  })

  it('should not send a plan upgrade email if the plan has not changed', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const subscription = (await stripe.subscriptions.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = (subscription.customer as string) + organisation.id
    organisation.pricingPlan.stripePriceId = subscription.items.data[0].price.id
    await (<EntityManager>global.em).flush()

    const payload = JSON.stringify({
      id: v4(),
      object: 'event',
      data: {
        object: {
          ...subscription,
          customer: organisation.pricingPlan.stripeCustomerId
        }
      },
      api_version: '2020-08-27',
      created: Date.now(),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'customer.subscription.updated'
    }, null, 2)

    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET
    })

    await request(global.app)
      .post('/public/webhooks/subscriptions')
      .set('stripe-signature', header)
      .send(payload)
      .expect(204)

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should update the organisation pricing plan end date if the plan was renewed', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const subscription = (await stripe.subscriptions.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = (subscription.customer as string) + organisation.id
    organisation.pricingPlan.stripePriceId = subscription.items.data[0].price.id
    organisation.pricingPlan.endDate = addDays(new Date(), 1)
    await (<EntityManager>global.em).flush()

    const payload = JSON.stringify({
      id: v4(),
      object: 'event',
      data: {
        object: {
          ...subscription,
          customer: organisation.pricingPlan.stripeCustomerId
        }
      },
      api_version: '2020-08-27',
      created: Date.now(),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'customer.subscription.updated'
    }, null, 2)

    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET
    })

    await request(global.app)
      .post('/public/webhooks/subscriptions')
      .set('stripe-signature', header)
      .send(payload)
      .expect(204)

    await (<EntityManager>global.em).refresh(organisation, { populate: ['pricingPlan'] })
    expect(organisation.pricingPlan.endDate).toBe(null)
    expect(sendMock).toHaveBeenCalledWith(new PlanRenewed(organisation).getConfig())
  })

  it('should update the organisation pricing plan end date if the plan was cancelled', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const subscription = (await stripe.subscriptions.list()).data[0]
    subscription.cancel_at_period_end = true

    organisation.pricingPlan.stripeCustomerId = (subscription.customer as string) + organisation.id
    organisation.pricingPlan.stripePriceId = subscription.items.data[0].price.id
    organisation.pricingPlan.endDate = null
    await (<EntityManager>global.em).flush()

    const payload = JSON.stringify({
      id: v4(),
      object: 'event',
      data: {
        object: {
          ...subscription,
          customer: organisation.pricingPlan.stripeCustomerId
        }
      },
      api_version: '2020-08-27',
      created: Date.now(),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'customer.subscription.updated'
    }, null, 2)

    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET
    })

    await request(global.app)
      .post('/public/webhooks/subscriptions')
      .set('stripe-signature', header)
      .send(payload)
      .expect(204)

    await (<EntityManager>global.em).refresh(organisation, { populate: ['pricingPlan'] })
    expect(organisation.pricingPlan.endDate.getMilliseconds()).toBe(new Date(subscription.current_period_end * 1000).getMilliseconds())
    expect(sendMock).toHaveBeenCalledWith(new PlanCancelled(organisation).getConfig())
  })

  it('should not send any plan cancellation/renewal emails if the subscription is not ending', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const subscription = (await stripe.subscriptions.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = (subscription.customer as string) + organisation.id
    organisation.pricingPlan.stripePriceId = subscription.items.data[0].price.id
    organisation.pricingPlan.endDate = null
    await (<EntityManager>global.em).flush()

    const payload = JSON.stringify({
      id: v4(),
      object: 'event',
      data: {
        object: {
          ...subscription,
          customer: organisation.pricingPlan.stripeCustomerId
        }
      },
      api_version: '2020-08-27',
      created: Date.now(),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'customer.subscription.updated'
    }, null, 2)

    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET
    })

    await request(global.app)
      .post('/public/webhooks/subscriptions')
      .set('stripe-signature', header)
      .send(payload)
      .expect(204)

    await (<EntityManager>global.em).refresh(organisation, { populate: ['pricingPlan'] })
    expect(organisation.pricingPlan.endDate).toBe(null)
    expect(sendMock).not.toHaveBeenCalled()
  })
})
