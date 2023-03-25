import { EntityManager } from '@mikro-orm/core'
import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import initStripe from '../../../../src/lib/billing/initStripe'
import PricingPlanFactory from '../../../fixtures/PricingPlanFactory'
import { v4 } from 'uuid'

const stripe = initStripe()

describe('Webhook service - subscription deleted', () => {
  it('should reset the organisation pricing plan to the default plan after the subscription is deleted', async () => {
    const [organisation] = await createOrganisationAndGame()
    const subscription = (await stripe.subscriptions.list()).data[0]
    const price = (await stripe.prices.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    organisation.pricingPlan.stripePriceId = price.id

    const defaultPlan = await new PricingPlanFactory().with(() => ({ default: true })).one()
    await (<EntityManager>global.em).persistAndFlush(defaultPlan)

    const payload = JSON.stringify({
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
    expect(organisation.pricingPlan.pricingPlan.id).toBe(defaultPlan.id)
  })
})
