import { EntityManager } from '@mikro-orm/mysql'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../entities/player-auth-activity.js'
import Player from '../../entities/player.js'

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

  const enrichment = player.game.playerAuthActivityEnrichment
    ? {
        userAgent,
        ip: type === PlayerAuthActivityType.DELETED_AUTH ? undefined : ip,
      }
    : {}

  activity.extra = {
    ...extra,
    ...enrichment,
    selfService: selfService || undefined,
  }

  em.persist(activity)

  return activity
}
