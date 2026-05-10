import Game from '../../src/entities/game.js'
import Organisation from '../../src/entities/organisation.js'
import PricingPlan from '../../src/entities/pricing-plan.js'
import GameFactory from '../fixtures/GameFactory.js'
import OrganisationFactory from '../fixtures/OrganisationFactory.js'
import OrganisationPricingPlanFactory from '../fixtures/OrganisationPricingPlanFactory.js'

export default async function createOrganisationAndGame(
  orgPartial?: Partial<Organisation>,
  gamePartial?: Partial<Game>,
  plan?: PricingPlan,
): Promise<[Organisation, Game]> {
  const organisation = await new OrganisationFactory().state(() => orgPartial ?? {}).one()
  if (plan) {
    const orgPlan = await new OrganisationPricingPlanFactory()
      .state(() => ({
        organisation,
        pricingPlan: plan,
      }))
      .one()
    organisation.pricingPlan = orgPlan
  }

  const game = await new GameFactory(organisation).state(() => gamePartial ?? {}).one()
  await em.persist([organisation, game]).flush()

  return [organisation, game]
}
