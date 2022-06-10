import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import initStripe from '../../../src/lib/billing/initStripe'
import PricingPlanFactory from '../../fixtures/PricingPlanFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import clearEntities from '../../utils/clearEntities'

const baseUrl = '/billing/plans'
const stripe = initStripe()

describe('Billing service - plans', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
    await clearEntities(app.context.em)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of pricing plans', async () => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame(app.context.em, {}, {}, plan)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)
    organisation.pricingPlan.stripePriceId = price.id
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .get(baseUrl)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.pricingPlans).toHaveLength(1)
    expect(res.body.pricingPlans[0].stripeId).toBe(product.id)
    expect(res.body.pricingPlans[0].prices).toHaveLength(1)
    expect(res.body.pricingPlans[0].prices[0]).toStrictEqual({
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring.interval,
      current: true
    })
  })

  it('should not return hidden plans', async () => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]

    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()
    const hiddenPlan = await new PricingPlanFactory().with(() => ({ hidden: true })).one()

    const [organisation] = await createOrganisationAndGame(app.context.em, {}, {}, plan)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)
    organisation.pricingPlan.stripePriceId = price.id
    await (<EntityManager>app.context.em).persistAndFlush(hiddenPlan)

    const res = await request(app.callback())
      .get(baseUrl)
      .auth(token, { type: 'bearer' })
      .expect(200)

    for (const plan of res.body.pricingPlans) {
      expect(plan.hidden).toBe(false)
    }
  })
})
