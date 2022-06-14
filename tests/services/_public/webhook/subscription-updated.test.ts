import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import initStripe from '../../../../src/lib/billing/initStripe'
import { v4 } from 'uuid'
import Organisation from '../../../../src/entities/organisation'
import PricingPlanFactory from '../../../fixtures/PricingPlanFactory'
import SendGrid from '@sendgrid/mail'
import PlanUpgraded from '../../../../src/emails/plan-upgraded-mail'
import { addDays } from 'date-fns'
import PlanRenewed from '../../../../src/emails/plan-renewed-mail'
import clearEntities from '../../../utils/clearEntities'
import PlanCancelled from '../../../../src/emails/plan-cancelled-mail'

const baseUrl = '/public/webhooks/subscriptions'
const stripe = initStripe()

describe('Webhook service - subscription updated', () => {
  let app: Koa
  const sendMock = jest.spyOn(SendGrid, 'send')

  beforeAll(async () => {
    app = await init()
  })

  beforeEach(async () => {
    await clearEntities(app.context.em)
  })

  afterEach(() => {
    sendMock.mockClear()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should update the organisation pricing plan with the updated subscription\'s details', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    let [organisation] = await createOrganisationAndGame(app.context.em, {}, {}, plan)
    const subscription = (await stripe.subscriptions.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    await (<EntityManager>app.context.em).flush()

    jest.spyOn(stripe.webhooks, 'constructEvent').mockImplementationOnce(() => ({
      id: v4(),
      object: 'event',
      data: {
        object: subscription
      },
      api_version: '2020-08-27',
      created: Date.now(),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'customer.subscription.updated'
    }))

    await request(app.callback())
      .post(baseUrl)
      .set('stripe-signature', 'abc123')
      .expect(204)

    organisation = await (<EntityManager>app.context.em).getRepository(Organisation).findOne(organisation.id, { refresh: true })
    const price = subscription.items.data[0].price
    expect(organisation.pricingPlan.stripePriceId).toBe(price.id)
    expect(sendMock).toHaveBeenCalledWith(new PlanUpgraded(organisation, price, product).getConfig())
  })

  it('should not send a plan upgrade email if the plan has not changed', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame(app.context.em, {}, {}, plan)
    const subscription = (await stripe.subscriptions.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    organisation.pricingPlan.stripePriceId = subscription.items.data[0].price.id
    await (<EntityManager>app.context.em).flush()

    jest.spyOn(stripe.webhooks, 'constructEvent').mockImplementationOnce(() => ({
      id: v4(),
      object: 'event',
      data: {
        object: subscription
      },
      api_version: '2020-08-27',
      created: Date.now(),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'customer.subscription.updated'
    }))

    await request(app.callback())
      .post(baseUrl)
      .set('stripe-signature', 'abc123')
      .expect(204)

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should update the organisation pricing plan end date if the plan was renewed', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    let [organisation] = await createOrganisationAndGame(app.context.em, {}, {}, plan)
    const subscription = (await stripe.subscriptions.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    organisation.pricingPlan.stripePriceId = subscription.items.data[0].price.id
    organisation.pricingPlan.endDate = addDays(new Date(), 1)
    await (<EntityManager>app.context.em).flush()

    jest.spyOn(stripe.webhooks, 'constructEvent').mockImplementationOnce(() => ({
      id: v4(),
      object: 'event',
      data: {
        object: subscription
      },
      api_version: '2020-08-27',
      created: Date.now(),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'customer.subscription.updated'
    }))

    await request(app.callback())
      .post(baseUrl)
      .set('stripe-signature', 'abc123')
      .expect(204)

    organisation = await (<EntityManager>app.context.em).getRepository(Organisation).findOne(organisation.id, { refresh: true })
    expect(organisation.pricingPlan.endDate).toBe(null)
    expect(sendMock).toHaveBeenCalledWith(new PlanRenewed(organisation).getConfig())
  })

  it('should update the organisation pricing plan end date if the plan was cancelled', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    let [organisation] = await createOrganisationAndGame(app.context.em, {}, {}, plan)
    const subscription = (await stripe.subscriptions.list()).data[0]
    subscription.cancel_at_period_end = true

    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    organisation.pricingPlan.stripePriceId = subscription.items.data[0].price.id
    organisation.pricingPlan.endDate = null
    await (<EntityManager>app.context.em).flush()

    jest.spyOn(stripe.webhooks, 'constructEvent').mockImplementationOnce(() => ({
      id: v4(),
      object: 'event',
      data: {
        object: subscription
      },
      api_version: '2020-08-27',
      created: Date.now(),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'customer.subscription.updated'
    }))

    await request(app.callback())
      .post(baseUrl)
      .set('stripe-signature', 'abc123')
      .expect(204)

    organisation = await (<EntityManager>app.context.em).getRepository(Organisation).findOne(organisation.id, { refresh: true })
    expect(organisation.pricingPlan.endDate.getMilliseconds()).toBe(new Date(subscription.current_period_end * 1000).getMilliseconds())
    expect(sendMock).toHaveBeenCalledWith(new PlanCancelled(organisation).getConfig())
  })

  it('should not send any plan cancellation/renewal emails if the subscription is not ending', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    let [organisation] = await createOrganisationAndGame(app.context.em, {}, {}, plan)
    const subscription = (await stripe.subscriptions.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    organisation.pricingPlan.stripePriceId = subscription.items.data[0].price.id
    organisation.pricingPlan.endDate = null
    await (<EntityManager>app.context.em).flush()

    jest.spyOn(stripe.webhooks, 'constructEvent').mockImplementationOnce(() => ({
      id: v4(),
      object: 'event',
      data: {
        object: subscription
      },
      api_version: '2020-08-27',
      created: Date.now(),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'customer.subscription.updated'
    }))

    await request(app.callback())
      .post(baseUrl)
      .set('stripe-signature', 'abc123')
      .expect(204)

    organisation = await (<EntityManager>app.context.em).getRepository(Organisation).findOne(organisation.id, { refresh: true })
    expect(organisation.pricingPlan.endDate).toBe(null)
    expect(sendMock).not.toHaveBeenCalled()
  })
})
