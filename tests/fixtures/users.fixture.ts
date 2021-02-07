import { EntityManager } from '@mikro-orm/core'
import User from '../../src/entities/user'

export default async (em: EntityManager) => {
  const user1 = new User()
  user1.email = 'tudor@sleepystudios.net'

  const user2 = new User()
  user2.email = 'relly@sleepystudios.net'

  await em.persistAndFlush([user1, user2])
}
