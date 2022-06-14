import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import initStripe from '../../../src/lib/billing/initStripe'
import PricingPlanFactory from '../../fixtures/PricingPlanFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'
import Organisation from '../../../src/entities/organisation'
import { UserType } from '../../../src/entities/user'
import { PricingPlanActionType } from '../../../src/entities/pricing-plan-action'
import OrganisationPricingPlanActionFactory from '../../fixtures/OrganisationPricingPlanActionFactory'
import OrganisationPricingPlanFactory from '../../fixtures/OrganisationPricingPlanFactory'
import PricingPlanActionFactory from '../../fixtures/PricingPlanActionFactory'

const baseUrl = '/billing/checkout-session'
const stripe = initStripe()

describe('Billing service - create checkout session', () => {
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

    let [organisation] = await createOrganisationAndGame(app.context.em, {}, {}, plan)
    const [token] = await createUserAndToken(app.context.em, { type }, organisation)

    organisation.pricingPlan.stripeCustomerId = null
    organisation.pricingPlan.stripePriceId = null
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(baseUrl)
      .send({
        pricingPlanId: plan.id,
        pricingInterval: price.recurring.interval
      })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      organisation = await (<EntityManager>app.context.em).getRepository(Organisation).findOne(organisation.id, { refresh: true })
      expect(typeof organisation.pricingPlan.stripeCustomerId).toBe('string')

      expect(res.body.redirect).toBeDefined()
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to update the organisation pricing plan' })
    }
  })

  it('should return a 404 for a plan that doesn\'t exist', async () => {
    const [token] = await createUserAndToken(app.context.em, { type: UserType.OWNER })

    const res = await request(app.callback())
      .post(baseUrl)
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
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const subscription = (await stripe.subscriptions.list()).data[0]

    const [organisation] = await createOrganisationAndGame(app.context.em, {}, {}, plan)
    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    await (<EntityManager>app.context.em).flush()

    const [token] = await createUserAndToken(app.context.em, { type: UserType.OWNER }, organisation)

    const res = await request(app.callback())
      .post(baseUrl)
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
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame(app.context.em, {}, {}, plan)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.OWNER }, organisation)

    const res = await request(app.callback())
      .post(baseUrl)
      .send({
        pricingPlanId: plan.id,
        pricingInterval: price.recurring.interval
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.redirect).toBeDefined()
  })

  it('should not preview a plan if there are more org plan actions for user invites than the pricing plan user limit', async () => {
    const planAction = await new PricingPlanActionFactory().with(() => ({ type: PricingPlanActionType.USER_INVITE })).one()
    const orgPlan = await new OrganisationPricingPlanFactory().with(() => ({ pricingPlan: planAction.pricingPlan })).one()
    const orgPlanActions = await new OrganisationPricingPlanActionFactory(orgPlan).with(() => ({ type: planAction.type })).many(planAction.limit)

    const [organisation] = await createOrganisationAndGame(app.context.em, { pricingPlan: orgPlan })
    const [token] = await createUserAndToken(app.context.em, { type: UserType.OWNER }, organisation)

    await (<EntityManager>app.context.em).persistAndFlush([planAction, ...orgPlanActions])

    const res = await request(app.callback())
      .post(baseUrl)
      .send({
        pricingPlanId: orgPlan.pricingPlan.id,
        pricingInterval: 'month'
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'You cannot downgrade your plan because your organisation has reached its member limit. This limit also includes pending organisation invites. Please contact support about removing users or invites.' })
  })
})
