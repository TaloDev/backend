import request from 'supertest'
import initStripe from '../../../../src/lib/billing/initStripe'
import PricingPlanFactory from '../../../fixtures/PricingPlanFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import userPermissionProvider from '../../../utils/userPermissionProvider'
import { UserType } from '../../../../src/entities/user'
import OrganisationPricingPlanFactory from '../../../fixtures/OrganisationPricingPlanFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import assert from 'node:assert'

describe('Billing service - create checkout session', () => {
  const stripe = initStripe()
  assert(stripe)

  it.each(userPermissionProvider())('should return a %i for a %s user', async (statusCode, _, type) => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().state(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const [token] = await createUserAndToken({ type }, organisation)

    organisation.pricingPlan.stripeCustomerId = null
    organisation.pricingPlan.stripePriceId = null
    await em.flush()

    const res = await request(app)
      .post('/billing/checkout-session')
      .send({
        pricingPlanId: plan.id,
        pricingInterval: price.recurring!.interval
      })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      await em.refresh(organisation)
      expect(typeof organisation.pricingPlan.stripeCustomerId).toBe('string')

      expect(res.body.redirect).toBeDefined()
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to update the organisation pricing plan' })
    }
  })

  it('should return a 404 for a plan that doesn\'t exist', async () => {
    const [token] = await createUserAndToken({ type: UserType.OWNER })

    const res = await request(app)
      .post('/billing/checkout-session')
      .send({
        pricingPlanId: Number.MAX_SAFE_INTEGER,
        pricingInterval: 'month'
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Pricing plan not found' })
  })

  it('should create an invoice preview if the organisation already has a subscription', async () => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().state(() => ({ stripeId: product.id })).one()

    const subscription = (await stripe.subscriptions.list()).data[0]

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    await em.flush()

    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const res = await request(app)
      .post('/billing/checkout-session')
      .send({
        pricingPlanId: plan.id,
        pricingInterval: price.recurring!.interval
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.invoice).toBeDefined()
  })

  it('should not create an invoice preview if the organisation has a stripeCustomerId but no subscriptions', async () => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().state(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const res = await request(app)
      .post('/billing/checkout-session')
      .send({
        pricingPlanId: plan.id,
        pricingInterval: price.recurring!.interval
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.redirect).toBeDefined()
  })

  it('should not preview a plan if they are over their current plan player limit', async () => {
    const plan = await new PricingPlanFactory().state(() => ({ playerLimit: 10 })).one()
    const orgPlan = await new OrganisationPricingPlanFactory().state(() => ({ pricingPlan: plan })).one()

    const [organisation] = await createOrganisationAndGame({ pricingPlan: orgPlan })
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const games = await orgPlan.organisation.games.loadItems()
    const players = await new PlayerFactory(games).many(10)

    await em.persistAndFlush([organisation, ...players])

    const res = await request(app)
      .post('/billing/checkout-session')
      .send({
        pricingPlanId: orgPlan.pricingPlan.id,
        pricingInterval: 'month'
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'You cannot downgrade your plan because your organisation has reached its player limit.' })
  })

  it('should preview a plan if the current plan has a null player limit', async () => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().state(() => ({ stripeId: product.id, playerLimit: null })).one()

    const subscription = (await stripe.subscriptions.list()).data[0]

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    await em.flush()

    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const res = await request(app)
      .post('/billing/checkout-session')
      .send({
        pricingPlanId: plan.id,
        pricingInterval: price.recurring!.interval
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.invoice).toBeDefined()
  })

  it('should return a 405 with no stripe key', async () => {
    const originalKey = process.env.STRIPE_KEY
    delete process.env.STRIPE_KEY

    const [token] = await createUserAndToken({ type: UserType.OWNER })

    await request(app)
      .post('/billing/checkout-session')
      .send({
        pricingPlanId: 1,
        pricingInterval: 'month'
      })
      .auth(token, { type: 'bearer' })
      .expect(405)

    process.env.STRIPE_KEY = originalKey
  })
})
