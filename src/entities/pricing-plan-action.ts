import { Entity, Enum, ManyToOne, PrimaryKey, Property, Rel } from '@mikro-orm/mysql'
import PricingPlan from './pricing-plan.js'

export enum PricingPlanActionType {
  USER_INVITE,
  DATA_EXPORT
}

@Entity()
export default class PricingPlanAction {
  @PrimaryKey()
  id: number

  @ManyToOne(() => PricingPlan)
  pricingPlan: Rel<PricingPlan>

  @Enum(() => PricingPlanActionType)
  type: PricingPlanActionType

  @Property()
  limit: number

  @Property()
  createdAt: Date = new Date()

  @Property()
  updatedAt: Date = new Date()

  isTrackedMonthly(): boolean {
    return [PricingPlanActionType.DATA_EXPORT].includes(this.type)
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      limit: this.limit,
      trackedMonthly: this.isTrackedMonthly()
    }
  }
}
