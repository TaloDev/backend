import { Factory } from 'hefty'
import casual from 'casual'
import OrganisationPricingPlan from '../../src/entities/organisation-pricing-plan'

export default class OrganisationPricingPlanFactory extends Factory<OrganisationPricingPlan> {
  constructor() {
    super(OrganisationPricingPlan, 'base')
    this.register('base', this.base)
  }

  protected async base(): Promise<Partial<OrganisationPricingPlan>> {
    return {
      stripePriceId: `price_${casual.uuid.split('-')[0]}`,
      stripeCustomerId: `cus_${casual.uuid.split('-')[0]}`
    }
  }
}
