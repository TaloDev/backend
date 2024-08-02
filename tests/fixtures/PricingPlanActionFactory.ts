import { Factory } from 'hefty'
import casual from 'casual'
import PricingPlanAction, { PricingPlanActionType } from '../../src/entities/pricing-plan-action'
import PricingPlanFactory from './PricingPlanFactory'

export default class PricingPlanActionFactory extends Factory<PricingPlanAction> {
  constructor() {
    super(PricingPlanAction)
  }

  protected definition(): void {
    this.state(async () => ({
      type: casual.random_element([
        PricingPlanActionType.USER_INVITE,
        PricingPlanActionType.DATA_EXPORT
      ]),
      limit: casual.integer(1, 10),
      pricingPlan: await new PricingPlanFactory().one()
    }))
  }
}
