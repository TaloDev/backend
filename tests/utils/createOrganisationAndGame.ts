import { EntityManager } from '@mikro-orm/mysql'
import Game from '../../src/entities/game.js'
import Organisation from '../../src/entities/organisation.js'
import PricingPlan from '../../src/entities/pricing-plan.js'
import GameFactory from '../fixtures/GameFactory.js'
import OrganisationFactory from '../fixtures/OrganisationFactory.js'
import OrganisationPricingPlanFactory from '../fixtures/OrganisationPricingPlanFactory.js'

export default async function createOrganisationAndGame(orgPartial?: Partial<Organisation>, gamePartial?: Partial<Game>, plan?: PricingPlan): Promise<[Organisation, Game]> {
  const organisation = await new OrganisationFactory().with(() => orgPartial).one()
  if (plan) {
    const orgPlan = await new OrganisationPricingPlanFactory().construct(organisation, plan).one()
    organisation.pricingPlan = orgPlan
  }

  const game = await new GameFactory(organisation).with(() => gamePartial).one()
  await (<EntityManager>global.em).persistAndFlush([organisation, game])

  return [organisation, game]
}
