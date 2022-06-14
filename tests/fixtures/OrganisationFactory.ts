import { Factory } from 'hefty'
import Organisation from '../../src/entities/organisation'
import casual from 'casual'
import PricingPlanFactory from './PricingPlanFactory'
import OrganisationPricingPlanFactory from './OrganisationPricingPlanFactory'

export default class OrganisationFactory extends Factory<Organisation> {
  constructor() {
    super(Organisation, 'base')

    this.register('base', this.base)
    this.register('demo', this.demo)
  }

  protected async base(organisation: Organisation): Promise<Partial<Organisation>> {
    const plan = await new PricingPlanFactory().one()
    const orgPlan = await new OrganisationPricingPlanFactory().construct(organisation, plan).one()

    return {
      email: casual.email,
      name: casual.company_name,
      pricingPlan: orgPlan
    }
  }

  protected demo(): Partial<Organisation> {
    return {
      name: process.env.DEMO_ORGANISATION_NAME
    }
  }
}
