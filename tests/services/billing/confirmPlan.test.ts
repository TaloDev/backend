import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import initStripe from '../../../src/lib/billing/initStripe.js'
import PricingPlanFactory from '../../fixtures/PricingPlanFactory.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../utils/createUserAndToken.js'
import userPermissionProvider from '../../utils/userPermissionProvider.js'
import { UserType } from '../../../src/entities/user.js'
import { addHours } from 'date-fns'

const stripe = initStripe()

describe('Billing service - confirm plan', () => {
  it.each(userPermissionProvider([], 204))('should return a %i for a %s user', async (statusCode, _, type) => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const subscription = (await stripe.subscriptions.list()).data[0]

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const [token] = await createUserAndToken({ type }, organisation)

    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    organisation.pricingPlan.stripePriceId = price.id
    await (<EntityManager>global.em).flush()

    const res = await request(global.app)
      .post('/billing/confirm-plan')
      .send({
        pricingPlanId: plan.id,
        pricingInterval: price.recurring.interval,
        prorationDate: Math.floor(Date.now() / 1000)
      })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode !== 204) {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to update the organisation pricing plan' })
    }
  })

  it('should return a 400 if the organisation doesn\'t have a stripeCustomerId', async () => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    organisation.pricingPlan.stripeCustomerId = null
    organisation.pricingPlan.stripePriceId = price.id
    await (<EntityManager>global.em).flush()

    await request(global.app)
      .post('/billing/confirm-plan')
      .send({
        pricingPlanId: plan.id,
        pricingInterval: price.recurring.interval,
        prorationDate: Math.floor(Date.now() / 1000)
      })
      .auth(token, { type: 'bearer' })
      .expect(400)
  })

  it('should return a 400 if the proration date is not in the same hour', async () => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().with(() => ({ stripeId: product.id })).one()

    const subscription = (await stripe.subscriptions.list()).data[0]

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    organisation.pricingPlan.stripePriceId = price.id
    await (<EntityManager>global.em).flush()

    await request(global.app)
      .post('/billing/confirm-plan')
      .send({
        pricingPlanId: plan.id,
        pricingInterval: price.recurring.interval,
        prorationDate: Math.floor(addHours(new Date(), 1).getMilliseconds() / 1000)
      })
      .auth(token, { type: 'bearer' })
      .expect(400)
  })
})
