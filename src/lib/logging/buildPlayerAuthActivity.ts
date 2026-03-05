import { EntityManager } from '@mikro-orm/mysql'
import Player from '../../entities/player'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../entities/player-auth-activity'

export function buildPlayerAuthActivity({
  em,
  player,
  type,
  ip,
  userAgent,
  selfService,
  extra,
}: {
  em: EntityManager
  player: Player
  type: PlayerAuthActivityType
  ip: string
  userAgent?: string
  selfService?: boolean
  extra?: Record<string, unknown>
}) {
  const activity = new PlayerAuthActivity(player)
  activity.type = type
  activity.extra = {
    ...extra,
    userAgent,
    ip: type === PlayerAuthActivityType.DELETED_AUTH ? undefined : ip,
    selfService: selfService || undefined,
  }

  em.persist(activity)

  return activity
}
