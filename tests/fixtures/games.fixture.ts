import { EntityManager } from '@mikro-orm/core'
import Game from '../../src/entities/game'
import Team from '../../src/entities/team'

export default async (em: EntityManager) => {
  const team1 = await em.getRepository(Team).findOne({ id: 1 })
  team1.games.add(new Game('Crawle'))
  team1.games.add(new Game('Superstatic'))

  const team2 = await em.getRepository(Team).findOne({ id: 2 })
  team2.games.add(new Game('Explorar'))
  team2.games.add(new Game('Fish Fight'))

  await em.persistAndFlush([team1, team2])
}
