import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import initStripe from '../../../../src/lib/billing/initStripe'
import PricingPlanFactory from '../../../fixtures/PricingPlanFactory'
import { v4 } from 'uuid'
import Organisation from '../../../../src/entities/organisation'
import clearEntities from '../../../utils/clearEntities'

const baseUrl = '/public/webhooks/subscriptions'
const stripe = initStripe()

describe('Webhook service - subscription deleted', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
    await clearEntities(app.context.em)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should reset the organisation pricing plan to the default plan after the subscription is deleted', async () => {
    let [organisation] = await createOrganisationAndGame(app.context.em, {}, {})
    const subscription = (await stripe.subscriptions.list()).data[0]
    const price = (await stripe.prices.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    organisation.pricingPlan.stripePriceId = price.id

    const defaultPlan = await new PricingPlanFactory().with(() => ({ default: true })).one()
    await (<EntityManager>app.context.em).persistAndFlush(defaultPlan)

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
      type: 'customer.subscription.deleted'
    }))

    await request(app.callback())
      .post(baseUrl)
      .set('stripe-signature', 'abc123')
      .expect(204)

    organisation = await (<EntityManager>app.context.em).getRepository(Organisation).findOne(organisation.id, { refresh: true })
    expect(organisation.pricingPlan.pricingPlan.id).toBe(defaultPlan.id)
  })
})