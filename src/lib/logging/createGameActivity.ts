import { EntityManager } from '@mikro-orm/core'
import GameActivity from '../../entities/game-activity'

export default async function createGameActivity(em: EntityManager, data: Partial<GameActivity>, flush = false): Promise<GameActivity> {
  const activity = new GameActivity(data.game, data.user)
  activity.type = data.type
  if (data.extra) activity.extra = data.extra

  em.persist(activity)
  if (flush) await em.flush()

  return activity
}
