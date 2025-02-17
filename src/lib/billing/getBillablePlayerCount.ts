import { EntityManager } from '@mikro-orm/mysql'
import Organisation from '../../entities/organisation'
import Player from '../../entities/player'

export default async function getBillablePlayerCount(em: EntityManager, organisation: Organisation): Promise<number> {
  return em.getRepository(Player).count({
    game: { organisation }
  })
}
