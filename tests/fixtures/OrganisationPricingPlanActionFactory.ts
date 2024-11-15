import { Factory } from 'hefty'
import OrganisationPricingPlanAction from '../../src/entities/organisation-pricing-plan-action'
import { PricingPlanActionType } from '../../src/entities/pricing-plan-action'
import OrganisationPricingPlan from '../../src/entities/organisation-pricing-plan'
import { rand } from '@ngneat/falso'

export default class OrganisationPricingPlanActionFactory extends Factory<OrganisationPricingPlanAction> {
  private orgPlan: OrganisationPricingPlan

  constructor(orgPlan: OrganisationPricingPlan) {
    super(OrganisationPricingPlanAction)

    this.orgPlan = orgPlan
  }

  protected definition(): void {
    this.state(() => ({
      type: rand([PricingPlanActionType.USER_INVITE, PricingPlanActionType.DATA_EXPORT]),
      organisationPricingPlan: this.orgPlan
    }))
  }
}
