import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import initStripe from '../../../../src/lib/billing/initStripe'
import { v4 } from 'uuid'
import PricingPlanFactory from '../../../fixtures/PricingPlanFactory'
import * as sendEmail from '../../../../src/lib/messaging/sendEmail'
import PlanUpgraded from '../../../../src/emails/plan-upgraded-mail'
import assert from 'node:assert'

describe('Webhook  - subscription created', () => {
  const sendMock = vi.spyOn(sendEmail, 'default')

  const stripe = initStripe()
  assert(stripe)

  afterEach(() => {
    sendMock.mockClear()
  })

  it('should update the organisation pricing plan with the updated subscription\'s details', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().state(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const subscription = (await stripe.subscriptions.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = (subscription.customer as string) + organisation.id
    await em.flush()

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
      type: 'customer.subscription.created'
    }, null, 2)

    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET!
    })

    await request(app)
      .post('/public/webhooks/subscriptions')
      .set('stripe-signature', header)
      .send(payload)
      .expect(204)

    await em.refresh(organisation)
    const price = subscription.items.data[0].price
    expect(organisation.pricingPlan.stripePriceId).toBe(price.id)
    expect(sendMock).toHaveBeenCalledWith(new PlanUpgraded(organisation, price, product).getConfig())
  })
})
