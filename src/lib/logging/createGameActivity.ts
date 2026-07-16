import { EntityManager } from '@mikro-orm/mysql'
import AdminAPIKey from '../../entities/admin-api-key.js'
import GameActivity from '../../entities/game-activity.js'
import Game from '../../entities/game.js'
import User from '../../entities/user.js'

type GameActivityData = {
  actor: User | AdminAPIKey
  type: GameActivity['type']
  game?: Game
  extra?: Record<string, unknown>
}

export default function createGameActivity(
  em: EntityManager,
  data: GameActivityData,
): GameActivity {
  const activity = new GameActivity(data.game ?? null, data.actor)
  activity.type = data.type
  activity.extra = data.extra ?? {}

  em.persist(activity)

  return activity
}
