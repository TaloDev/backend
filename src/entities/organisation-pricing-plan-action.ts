import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import OrganisationPricingPlan from './organisation-pricing-plan'
import { PricingPlanActionType } from './pricing-plan-action'

export type OrganisationPricingPlanActionExtra = {
  invitedUserEmail?: string
  initialUser?: boolean,
  dataExportId?: number
}

@Entity()
export default class OrganisationPricingPlanAction {
  @PrimaryKey()
  id: number

  @ManyToOne(() => OrganisationPricingPlan)
  organisationPricingPlan: OrganisationPricingPlan

  @Enum(() => PricingPlanActionType)
  type: PricingPlanActionType

  @Property({ type: 'json' })
  extra: OrganisationPricingPlanActionExtra = {}

  @Property()
  createdAt: Date = new Date()
}
