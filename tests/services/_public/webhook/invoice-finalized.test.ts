import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import initStripe from '../../../../src/lib/billing/initStripe'
import { v4 } from 'uuid'
import PricingPlanFactory from '../../../fixtures/PricingPlanFactory'
import SendGrid from '@sendgrid/mail'
import clearEntities from '../../../utils/clearEntities'
import PlanInvoice from '../../../../src/emails/plan-invoice-mail'

const baseUrl = '/public/webhooks/subscriptions'
const stripe = initStripe()

describe('Webhook service - invoice finalized', () => {
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

  it('should send an invoice email when an invoice is finalised', async () => {
    const product = (await stripe.products.list()).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame(app.context.em, {}, {}, plan)
    const invoice = (await stripe.invoices.list()).data[0]

    organisation.pricingPlan.stripeCustomerId = invoice.customer as string
    await (<EntityManager>app.context.em).flush()

    jest.spyOn(stripe.webhooks, 'constructEvent').mockImplementationOnce(() => ({
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
    }))

    await request(app.callback())
      .post(baseUrl)
      .set('stripe-signature', 'abc123')
      .expect(204)

    expect(sendMock).toHaveBeenCalledWith(new PlanInvoice(organisation, invoice).getConfig())
  })
})
