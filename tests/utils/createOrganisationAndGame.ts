import { EntityManager } from '@mikro-orm/core'
import Game from '../../src/entities/game'
import Organisation from '../../src/entities/organisation'
import PricingPlan from '../../src/entities/pricing-plan'
import GameFactory from '../fixtures/GameFactory'
import OrganisationFactory from '../fixtures/OrganisationFactory'
import OrganisationPricingPlanFactory from '../fixtures/OrganisationPricingPlanFactory'

export default async function createOrganisationAndGame(em: EntityManager, orgPartial?: Partial<Organisation>, gamePartial?: Partial<Game>, plan?: PricingPlan): Promise<[Organisation, Game]> {
  const organisation = await new OrganisationFactory().with(() => orgPartial).one()
  if (plan) {
    const orgPlan = await new OrganisationPricingPlanFactory().construct(organisation, plan).one()
    organisation.pricingPlan = orgPlan
  }

  const game = await new GameFactory(organisation).with(() => gamePartial).one()
  await em.persistAndFlush([organisation, game])

  return [organisation, game]
}
