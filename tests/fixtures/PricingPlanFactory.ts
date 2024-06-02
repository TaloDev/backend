import { Factory } from 'hefty'
import casual from 'casual'
import PricingPlan from '../../src/entities/pricing-plan.js'

export default class PricingPlanFactory extends Factory<PricingPlan> {
  constructor() {
    super(PricingPlan, 'base')
    this.register('base', this.base)
  }

  protected async base(): Promise<Partial<PricingPlan>> {
    return {
      stripeId: `prod_${casual.uuid.split('-')[0]}`
    }
  }
}
