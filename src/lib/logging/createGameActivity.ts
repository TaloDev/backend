import { EntityManager } from '@mikro-orm/mysql'
import GameActivity from '../../entities/game-activity'
import Game from '../../entities/game'

type GameActivityData = Pick<GameActivity, 'user' | 'type'> & { game?: Game, extra?: Record<string, unknown> }

export default function createGameActivity(em: EntityManager, data: GameActivityData): GameActivity {
  const activity = new GameActivity(data.game ?? null, data.user)
  activity.type = data.type
  activity.extra = data.extra ?? {}

  em.persist(activity)

  return activity
}
