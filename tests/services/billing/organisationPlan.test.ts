import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import initStripe from '../../../src/lib/billing/initStripe'
import PricingPlanFactory from '../../fixtures/PricingPlanFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'

const baseUrl = '/billing/organisation-plan'
const stripe = initStripe()

describe('Billing service - organisation plan', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it.each(userPermissionProvider())('should return a %i for a %s user', async (statusCode, _, type) => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const subscription = (await stripe.subscriptions.list()).data[0]

    const [organisation] = await createOrganisationAndGame(app.context.em, {}, {}, plan)
    const [token] = await createUserAndToken(app.context.em, { type }, organisation)

    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    organisation.pricingPlan.stripePriceId = price.id
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .get(baseUrl)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.pricingPlan).toBeDefined()
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to view the organisation pricing plan' })
    }
  })
})
