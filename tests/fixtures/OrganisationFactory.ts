import { Factory } from 'hefty'
import Organisation from '../../src/entities/organisation'
import PricingPlanFactory from './PricingPlanFactory'
import OrganisationPricingPlanFactory from './OrganisationPricingPlanFactory'
import { randCompanyName, randEmail } from '@ngneat/falso'

export default class OrganisationFactory extends Factory<Organisation> {
  constructor() {
    super(Organisation)
  }

  protected definition(): void {
    this.state(async (organisation) => {
      const plan = await new PricingPlanFactory().one()
      const orgPlan = await new OrganisationPricingPlanFactory().state(() => ({
        organisation,
        pricingPlan: plan
      })).one()

      return {
        email: randEmail(),
        name: randCompanyName(),
        pricingPlan: orgPlan
      }
    })
  }

  demo(): this {
    return this.state(() => ({
      name: process.env.DEMO_ORGANISATION_NAME
    }))
  }
}
