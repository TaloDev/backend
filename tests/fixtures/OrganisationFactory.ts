import { Factory } from 'hefty'
import Organisation from '../../src/entities/organisation'
import casual from 'casual'

export default class OrganisationFactory extends Factory<Organisation> {
  constructor() {
    super(Organisation, 'base')

    this.register('base', this.base)
    this.register('demo', this.demo)
  }

  protected base(): Partial<Organisation> {
    return {
      email: casual.email,
      name: casual.company_name
    }
  }

  protected demo(): Partial<Organisation> {
    return {
      name: process.env.DEMO_ORGANISATION_NAME
    }
  }
}
