import type { EntityManager } from '@mikro-orm/mysql'
import User from '../../entities/user'
import { differenceInDays } from 'date-fns'

export async function setUserLastSeenAt({ em, user }: {
  em: EntityManager
  user: User
}) {
  if (differenceInDays(new Date(), user.lastSeenAt) >= 1) {
    user.lastSeenAt = new Date()
    await em.flush()
  }
}
