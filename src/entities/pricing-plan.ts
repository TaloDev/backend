import { Collection, Entity, OneToMany, PrimaryKey, Property } from '@mikro-orm/mysql'
import PricingPlanAction from './pricing-plan-action'

@Entity()
export default class PricingPlan {
  @PrimaryKey()
  id: number

  @Property()
  stripeId: string

  @Property({ default: false })
  hidden: boolean

  @Property({ default: false })
  default: boolean

  @OneToMany(() => PricingPlanAction, (action) => action.pricingPlan)
  actions: Collection<PricingPlanAction> = new Collection<PricingPlanAction>(this)

  @Property()
  createdAt: Date = new Date()

  @Property()
  updatedAt: Date = new Date()

  toJSON() {
    return {
      id: this.id,
      stripeId: this.stripeId,
      hidden: this.hidden,
      default: this.default,
      actions: this.actions
    }
  }
}
