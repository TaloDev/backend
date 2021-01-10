import { EntityManager } from '@mikro-orm/core'
import User from '../../src/entities/user'
import Team from '../../src/entities/team'

export default async (em: EntityManager) => {
  const team1 = await em.getRepository(Team).findOne({ id: 1 })
  const user1 = new User()
  user1.email = 'tudor@sleepystudios.net'
  // set team

  const team2 = await em.getRepository(Team).findOne({ id: 2 })
  const user2 = new User()
  user2.email = 'relly@sleepystudios.net'
  // set team

  await em.persistAndFlush([user1, user2])
}
