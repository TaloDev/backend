import { EntityManager } from '@mikro-orm/mysql'
import Organisation from '../../entities/organisation.js'
import createDefaultPricingPlan from '../billing/createDefaultPricingPlan.js'

export async function createOrganisationForUser(em: EntityManager, name: string, email: string) {
  const organisation = new Organisation()
  organisation.name = name
  organisation.email = email
  organisation.pricingPlan = await createDefaultPricingPlan(em, organisation)
  em.persist(organisation)
  return organisation
}
