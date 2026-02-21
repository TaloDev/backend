import { randUuid } from '@ngneat/falso'
import { Factory } from 'hefty'
import PricingPlan from '../../src/entities/pricing-plan'

export default class PricingPlanFactory extends Factory<PricingPlan> {
  constructor() {
    super(PricingPlan)
  }

  protected override definition() {
    this.state(() => ({
      stripeId: `prod_${randUuid().split('-')[0]}`,
      playerLimit: 10000,
    }))
  }
}
