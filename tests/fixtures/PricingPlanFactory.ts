import { Factory } from 'hefty'
import casual from 'casual'
import PricingPlan from '../../src/entities/pricing-plan'

export default class PricingPlanFactory extends Factory<PricingPlan> {
  constructor() {
    super(PricingPlan)
  }

  protected definition(): void {
    this.state(() => ({
      stripeId: `prod_${casual.uuid.split('-')[0]}`
    }))
  }
}
