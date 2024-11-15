import { Factory } from 'hefty'
import OrganisationPricingPlan from '../../src/entities/organisation-pricing-plan'
import { randUuid } from '@ngneat/falso'

export default class OrganisationPricingPlanFactory extends Factory<OrganisationPricingPlan> {
  constructor() {
    super(OrganisationPricingPlan)
  }

  protected definition(): void {
    this.state(() => ({
      stripePriceId: `price_${randUuid().split('-')[0]}`,
      stripeCustomerId: `cus_${randUuid().split('-')[0]}`,
      status: 'active'
    }))
  }
}
