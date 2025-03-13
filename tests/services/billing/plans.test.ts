import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import initStripe from '../../../src/lib/billing/initStripe'
import PricingPlanFactory from '../../fixtures/PricingPlanFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

const stripe = initStripe()!

describe('Billing service - plans', () => {
  it('should return a list of pricing plans', async () => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().state(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const [token] = await createUserAndToken({}, organisation)
    organisation.pricingPlan.stripePriceId = price.id
    await (<EntityManager>global.em).flush()

    const res = await request(global.app)
      .get('/billing/plans')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.pricingPlans).toHaveLength(1)
    expect(res.body.pricingPlans[0].stripeId).toBe(product.id)
    expect(res.body.pricingPlans[0].prices).toHaveLength(1)
    expect(res.body.pricingPlans[0].prices[0]).toStrictEqual({
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring!.interval,
      current: true
    })
  })

  it('should not return hidden plans', async () => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]

    const plan = await new PricingPlanFactory().state(() => ({ stripeId: product.id })).one()
    const hiddenPlan = await new PricingPlanFactory().state(() => ({ hidden: true })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const [token] = await createUserAndToken({}, organisation)
    organisation.pricingPlan.stripePriceId = price.id
    await (<EntityManager>global.em).persistAndFlush(hiddenPlan)

    const res = await request(global.app)
      .get('/billing/plans')
      .auth(token, { type: 'bearer' })
      .expect(200)

    for (const plan of res.body.pricingPlans) {
      expect(plan.hidden).toBe(false)
    }
  })
})
