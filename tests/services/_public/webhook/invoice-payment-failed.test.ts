import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import initStripe from '../../../../src/lib/billing/initStripe'
import { v4 } from 'uuid'
import PricingPlanFactory from '../../../fixtures/PricingPlanFactory'
import SendGrid from '@sendgrid/mail'
import PlanPaymentFailed from '../../../../src/emails/plan-payment-failed'

const stripe = initStripe()!

describe('Webhook service - invoice payment failed', () => {
  const sendMock = vi.spyOn(SendGrid, 'send')

  afterEach(() => {
    sendMock.mockClear()
  })

  it('should send an invoice email when an invoice payment fails', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().state(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const invoice = (await stripe.invoices.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = invoice.customer as string
    await em.flush()

    const payload = JSON.stringify({
      id: v4(),
      object: 'event',
      data: {
        object: invoice
      },
      api_version: '2020-08-27',
      created: Date.now(),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'invoice.payment_failed'
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

    expect(sendMock).toHaveBeenCalledWith(new PlanPaymentFailed(organisation, invoice).getConfig())
  })
})
