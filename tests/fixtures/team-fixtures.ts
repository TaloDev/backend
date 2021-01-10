import { EntityManager } from '@mikro-orm/core'
import Team from '../../src/entities/team'

export default async (em: EntityManager) => {
  const team1 = new Team('Sleepy Studios')
  const team2 = new Team('Darrel Roll Games')
  await em.persistAndFlush([team1, team2])
}
