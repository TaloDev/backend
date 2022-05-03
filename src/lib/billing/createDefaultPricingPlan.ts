import { EntityManager } from '@mikro-orm/core'
import Organisation from '../../entities/organisation'
import OrganisationPricingPlan from '../../entities/organisation-pricing-plan'
import PricingPlan from '../../entities/pricing-plan'
import initStripe from './initStripe'

export default async function createDefaultPricingPlan(em: EntityManager, organisation: Organisation): Promise<OrganisationPricingPlan> {
  const stripe = initStripe()

  const defaultPlan = await em.getRepository(PricingPlan).findOne({ default: true })

  let price: string
  if (process.env.STRIPE_KEY) {
    const prices = await stripe.prices.list({ product: defaultPlan.stripeId, active: true })
    price = prices.data[0].id
  }

  if (!organisation.pricingPlan) {
    const organisationPricingPlan = new OrganisationPricingPlan(organisation, defaultPlan)
    organisationPricingPlan.stripePriceId = price
    return organisationPricingPlan
  } else {
    organisation.pricingPlan.pricingPlan = defaultPlan
    organisation.pricingPlan.status = 'active'
    organisation.pricingPlan.stripePriceId = price
    organisation.pricingPlan.endDate = null
    return organisation.pricingPlan
  }
}
