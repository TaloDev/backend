import PlayerAuthActivity, { PlayerAuthActivityType } from '../../entities/player-auth-activity'
import Player from '../../entities/player'
import { Request } from 'koa-clay'
import { EntityManager } from '@mikro-orm/mysql'

export default function createPlayerAuthActivity(
  req: Request,
  player: Player,
  data: { type: PlayerAuthActivityType, extra?: Record<string, unknown> }
): PlayerAuthActivity {
  const em: EntityManager = req.ctx.em

  const ip = req.ctx.request.ip

  const activity = new PlayerAuthActivity(player)
  activity.type = data.type
  activity.extra = {
    ...(data.extra ?? {}),
    userAgent: req.headers['user-agent'],
    ip: data.type === PlayerAuthActivityType.DELETED_AUTH ? undefined : ip
  }

  em.persist(activity)

  return activity
}
