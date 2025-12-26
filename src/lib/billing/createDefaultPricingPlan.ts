import { EntityManager } from '@mikro-orm/mysql'
import Organisation from '../../entities/organisation'
import OrganisationPricingPlan from '../../entities/organisation-pricing-plan'
import PricingPlan from '../../entities/pricing-plan'
import initStripe from './initStripe'

export default async function createDefaultPricingPlan(em: EntityManager, organisation: Organisation): Promise<OrganisationPricingPlan> {
  const stripe = initStripe()

  let defaultPlan = await em.getRepository(PricingPlan).findOne({ default: true })

  let price: string | null = null
  if (process.env.STRIPE_KEY && defaultPlan) {
    const prices = await stripe!.prices.list({ product: defaultPlan.stripeId, active: true })
    const activePrice = prices.data[0]
    if (!activePrice) {
      throw new Error('No active price found for default pricing plan')
    }
    price = activePrice.id
  } else {
    // self-hosted logic
    defaultPlan = new PricingPlan()
    defaultPlan.stripeId = ''
    defaultPlan.default = true
  }

  if (!organisation.pricingPlan) {
    const organisationPricingPlan = new OrganisationPricingPlan(organisation, defaultPlan)
    organisationPricingPlan.stripePriceId = price
    return organisationPricingPlan
  } else {
    organisation.pricingPlan.pricingPlan = defaultPlan
    organisation.pricingPlan.status = 'active'
    organisation.pricingPlan.stripePriceId = price!
    organisation.pricingPlan.endDate = null
    return organisation.pricingPlan
  }
}
