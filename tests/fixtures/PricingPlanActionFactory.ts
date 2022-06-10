import { Factory } from 'hefty'
import casual from 'casual'
import PricingPlanAction, { PricingPlanActionType } from '../../src/entities/pricing-plan-action'
import PricingPlanFactory from './PricingPlanFactory'

export default class PricingPlanActionFactory extends Factory<PricingPlanAction> {
  constructor() {
    super(PricingPlanAction, 'base')
    this.register('base', this.base)
  }

  protected async base(): Promise<Partial<PricingPlanAction>> {
    const pricingPlan = await new PricingPlanFactory().one()

    return {
      type: casual.random_element([
        PricingPlanActionType.USER_INVITE,
        PricingPlanActionType.DATA_EXPORT
      ]),
      limit: casual.integer(1, 10),
      pricingPlan
    }
  }
}
