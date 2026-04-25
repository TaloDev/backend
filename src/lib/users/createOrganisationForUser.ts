import { EntityManager } from '@mikro-orm/mysql'
import Organisation from '../../entities/organisation'
import createDefaultPricingPlan from '../billing/createDefaultPricingPlan'

export async function createOrganisationForUser(em: EntityManager, name: string, email: string) {
  const organisation = new Organisation()
  organisation.name = name
  organisation.email = email
  organisation.pricingPlan = await createDefaultPricingPlan(em, organisation)
  em.persist(organisation)
  return organisation
}
