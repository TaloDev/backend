import { Factory } from 'hefty'
import casual from 'casual'
import PricingPlanAction, { PricingPlanActionType } from '../../src/entities/pricing-plan-action'
import PricingPlan from '../../src/entities/pricing-plan'

export default class PricingPlanActionFactory extends Factory<PricingPlanAction> {
  private pricingPlan: PricingPlan

  constructor(pricingPlan: PricingPlan) {
    super(PricingPlanAction, 'base')
    this.register('base', this.base)

    this.pricingPlan = pricingPlan
  }

  protected async base(): Promise<Partial<PricingPlanAction>> {
    return {
      type: casual.random_element([
        PricingPlanActionType.USER_INVITE,
        PricingPlanActionType.DATA_EXPORT
      ]),
      limit: casual.integer(1, 10),
      pricingPlan: this.pricingPlan
    }
  }
}
