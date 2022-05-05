import { EntityManager } from '@mikro-orm/core'
import Game from '../../src/entities/game'
import Organisation from '../../src/entities/organisation'
import GameFactory from '../fixtures/GameFactory'
import OrganisationFactory from '../fixtures/OrganisationFactory'

export default async function createOrganisationAndGame(em: EntityManager, orgPartial?: Partial<Organisation>, gamePartial?: Partial<Game>): Promise<[Organisation, Game]> {
  const organisation = await new OrganisationFactory().with(() => orgPartial).one()
  const game = await new GameFactory(organisation).with(() => gamePartial).one()
  await em.persistAndFlush([organisation, game])

  return [organisation, game]
}
