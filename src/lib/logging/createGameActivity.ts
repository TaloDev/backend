import { EntityManager } from '@mikro-orm/mysql'
import GameActivity from '../../entities/game-activity.js'

export default async function createGameActivity(em: EntityManager, data: Partial<GameActivity>): Promise<GameActivity> {
  const activity = new GameActivity(data.game, data.user)
  activity.type = data.type
  activity.extra = data.extra ?? {}

  em.persist(activity)

  return activity
}
