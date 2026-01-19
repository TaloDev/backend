import request from 'supertest'
import initStripe from '../../../src/lib/billing/initStripe'
import PricingPlanFactory from '../../fixtures/PricingPlanFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'
import { UserType } from '../../../src/entities/user'
import assert from 'node:assert'

describe('Billing service - create portal session', () => {
  const stripe = initStripe()
  assert(stripe)

  it.each(userPermissionProvider())('should return a %i for a %s user', async (statusCode, _, type) => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().state(() => ({ stripeId: product.id })).one()

    const subscription = (await stripe.subscriptions.list()).data[0]

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const [token] = await createUserAndToken({ type }, organisation)

    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    organisation.pricingPlan.stripePriceId = price.id
    await em.flush()

    const res = await request(app)
      .post('/billing/portal-session')
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.redirect).toBeDefined()
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to update the organisation pricing plan' })
    }
  })

  it('should return a 400 if the organisation doesn\'t have a stripeCustomerId', async () => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().state(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    organisation.pricingPlan.stripeCustomerId = null
    organisation.pricingPlan.stripePriceId = price.id
    await em.flush()

    await request(app)
      .post('/billing/portal-session')
      .auth(token, { type: 'bearer' })
      .expect(400)
  })

  it('should return a 405 with no stripe key', async () => {
    const originalKey = process.env.STRIPE_KEY
    delete process.env.STRIPE_KEY

    const [token] = await createUserAndToken({ type: UserType.OWNER })

    await request(app)
      .post('/billing/portal-session')
      .auth(token, { type: 'bearer' })
      .expect(405)

    process.env.STRIPE_KEY = originalKey
  })
})
