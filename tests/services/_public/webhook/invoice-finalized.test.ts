import { EntityManager } from '@mikro-orm/core'
import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import initStripe from '../../../../src/lib/billing/initStripe'
import { v4 } from 'uuid'
import PricingPlanFactory from '../../../fixtures/PricingPlanFactory'
import SendGrid from '@sendgrid/mail'
import PlanInvoice from '../../../../src/emails/plan-invoice-mail'

const stripe = initStripe()

describe('Webhook service - invoice finalized', () => {
  const sendMock = vi.spyOn(SendGrid, 'send')

  afterEach(() => {
    sendMock.mockClear()
  })

  it('should send an invoice email when an invoice is finalised', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const invoice = (await stripe.invoices.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = invoice.customer as string
    await (<EntityManager>global.em).flush()

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
      type: 'invoice.finalized'
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

    expect(sendMock).toHaveBeenCalledWith(new PlanInvoice(organisation, invoice).getConfig())
  })
})
