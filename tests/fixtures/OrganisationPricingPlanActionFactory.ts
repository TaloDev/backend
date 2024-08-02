import { Factory } from 'hefty'
import casual from 'casual'
import OrganisationPricingPlanAction from '../../src/entities/organisation-pricing-plan-action'
import { PricingPlanActionType } from '../../src/entities/pricing-plan-action'
import OrganisationPricingPlan from '../../src/entities/organisation-pricing-plan'

export default class OrganisationPricingPlanActionFactory extends Factory<OrganisationPricingPlanAction> {
  private orgPlan: OrganisationPricingPlan

  constructor(orgPlan: OrganisationPricingPlan) {
    super(OrganisationPricingPlanAction)

    this.orgPlan = orgPlan
  }

  protected definition(): void {
    this.state(() => ({
      type: casual.random_element([PricingPlanActionType.USER_INVITE, PricingPlanActionType.DATA_EXPORT]),
      organisationPricingPlan: this.orgPlan
    }))
  }
}
