import { Factory } from 'hefty'
import PricingPlanAction, { PricingPlanActionType } from '../../src/entities/pricing-plan-action'
import PricingPlanFactory from './PricingPlanFactory'
import { rand, randNumber } from '@ngneat/falso'

export default class PricingPlanActionFactory extends Factory<PricingPlanAction> {
  constructor() {
    super(PricingPlanAction)
  }

  protected definition(): void {
    this.state(async () => ({
      type: rand([
        PricingPlanActionType.USER_INVITE,
        PricingPlanActionType.DATA_EXPORT
      ]),
      limit: randNumber({ min: 1, max: 10 }),
      pricingPlan: await new PricingPlanFactory().one()
    }))
  }
}
