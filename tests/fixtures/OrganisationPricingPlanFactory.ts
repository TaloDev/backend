import { randUuid } from '@ngneat/falso'
import { Factory } from 'hefty'
import OrganisationPricingPlan from '../../src/entities/organisation-pricing-plan'

export default class OrganisationPricingPlanFactory extends Factory<OrganisationPricingPlan> {
  constructor() {
    super(OrganisationPricingPlan)
  }

  protected override definition() {
    this.state(() => ({
      stripePriceId: `price_${randUuid().split('-')[0]}`,
      stripeCustomerId: `cus_${randUuid().split('-')[0]}`,
      status: 'active',
    }))
  }
}
