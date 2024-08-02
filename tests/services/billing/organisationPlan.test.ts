import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import initStripe from '../../../src/lib/billing/initStripe'
import PricingPlanFactory from '../../fixtures/PricingPlanFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'
import { UserType } from '../../../src/entities/user'

const stripe = initStripe()

describe('Billing service - organisation plan', () => {
  it.each(userPermissionProvider())('should return a %i for a %s user', async (statusCode, _, type) => {
    const product = (await stripe.products.list()).data[0]
    const price = (await stripe.prices.list({ product: product.id })).data[0]
    const plan = await new PricingPlanFactory().state(() => ({ stripeId: product.id })).one()

    const subscription = (await stripe.subscriptions.list()).data[0]

    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const [token] = await createUserAndToken({ type }, organisation)

    organisation.pricingPlan.stripeCustomerId = subscription.customer as string
    organisation.pricingPlan.stripePriceId = price.id
    await (<EntityManager>global.em).flush()

    const res = await request(global.app)
      .get('/billing/organisation-plan')
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.pricingPlan).toBeDefined()
      expect(res.body.pricingPlan.canViewBillingPortal).toBe(true)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to view the organisation pricing plan' })
    }
  })

  it('should not let them view the billing portal if there is no stripeCustomerId', async () => {
    const plan = await new PricingPlanFactory().one()
    const [organisation] = await createOrganisationAndGame({}, {}, plan)
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    organisation.pricingPlan.stripeCustomerId = null
    organisation.pricingPlan.stripePriceId = null
    await (<EntityManager>global.em).flush()

    const res = await request(global.app)
      .get('/billing/organisation-plan')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.pricingPlan.canViewBillingPortal).toBe(false)
  })
})
