import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import initStripe from '../../../src/lib/billing/initStripe'
import PricingPlanFactory from '../../fixtures/PricingPlanFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'
import { UserType } from '../../../src/entities/user'
import { PricingPlanActionType } from '../../../src/entities/pricing-plan-action'
import OrganisationPricingPlanActionFactory from '../../fixtures/OrganisationPricingPlanActionFactory'
import OrganisationPricingPlanFactory from '../../fixtures/OrganisationPricingPlanFactory'
import PricingPlanActionFactory from '../../fixtures/PricingPlanActionFactory'

const stripe = initStripe()

describe('Billing service - create checkout session', () => {
  it.each(userPermissionProvider())('should return a %i for a %s user', async (statusCode, _, type) => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().state(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const [token] = await createUserAndToken({ type }, organisation)

    organisation.pricingPlan.stripeCustomerId = null
    organisation.pricingPlan.stripePriceId = null
    await (<EntityManager>global.em).flush()

    const res = await request(global.app)
      .post('/billing/checkout-session')
      .send({
        pricingPlanId: plan.id,
        pricingInterval: price.recurring.interval
      })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      await (<EntityManager>global.em).refresh(organisation)
      expect(typeof organisation.pricingPlan.stripeCustomerId).toBe('string')

      expect(res.body.redirect).toBeDefined()
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to update the organisation pricing plan' })
    }
  })

  it('should return a 404 for a plan that doesn\'t exist', async () => {
    const [token] = await createUserAndToken({ type: UserType.OWNER })

    const res = await request(global.app)
      .post('/billing/checkout-session')
      .send({
        pricingPlanId: 'abc123',
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
    await (<EntityManager>global.em).flush()

    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const res = await request(global.app)
      .post('/billing/checkout-session')
      .send({
        pricingPlanId: plan.id,
        pricingInterval: price.recurring.interval
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

    const res = await request(global.app)
      .post('/billing/checkout-session')
      .send({
        pricingPlanId: plan.id,
        pricingInterval: price.recurring.interval
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.redirect).toBeDefined()
  })

  it('should not preview a plan if there are more org plan actions for user invites than the pricing plan user limit', async () => {
    const planAction = await new PricingPlanActionFactory().state(() => ({ type: PricingPlanActionType.USER_INVITE })).one()
    const orgPlan = await new OrganisationPricingPlanFactory().state(() => ({ pricingPlan: planAction.pricingPlan })).one()
    const orgPlanActions = await new OrganisationPricingPlanActionFactory(orgPlan).state(() => ({ type: planAction.type })).many(planAction.limit)

    const [organisation] = await createOrganisationAndGame({ pricingPlan: orgPlan })
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    await (<EntityManager>global.em).persistAndFlush([planAction, ...orgPlanActions])

    const res = await request(global.app)
      .post('/billing/checkout-session')
      .send({
        pricingPlanId: orgPlan.pricingPlan.id,
        pricingInterval: 'month'
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'You cannot downgrade your plan because your organisation has reached its member limit. This limit also includes pending organisation invites. Please contact support about removing users or invites.' })
  })
})
