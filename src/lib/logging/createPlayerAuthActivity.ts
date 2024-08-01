import PlayerAuthActivity from '../../entities/player-auth-activity'
import Player from '../../entities/player'
import { Request } from 'koa-clay'
import { EntityManager } from '@mikro-orm/mysql'

export default function createPlayerAuthActivity(
  req: Request,
  player: Player,
  data: Pick<Partial<PlayerAuthActivity>, 'type' | 'extra'>
): PlayerAuthActivity {
  const em: EntityManager = req.ctx.em

  const activity = new PlayerAuthActivity(player)
  activity.type = data.type
  activity.extra = {
    ...(data.extra ?? {}),
    userAgent: req.headers['user-agent'],
    ip: req.ctx.request.ip
  }

  em.persist(activity)

  return activity
}
