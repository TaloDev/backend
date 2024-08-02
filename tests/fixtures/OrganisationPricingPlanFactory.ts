import { Factory } from 'hefty'
import casual from 'casual'
import OrganisationPricingPlan from '../../src/entities/organisation-pricing-plan'

export default class OrganisationPricingPlanFactory extends Factory<OrganisationPricingPlan> {
  constructor() {
    super(OrganisationPricingPlan)
  }

  protected definition(): void {
    this.state(() => ({
      stripePriceId: `price_${casual.uuid.split('-')[0]}`,
      stripeCustomerId: `cus_${casual.uuid.split('-')[0]}`,
      status: 'active'
    }))
  }
}
