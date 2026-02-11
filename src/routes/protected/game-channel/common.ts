import { Next } from 'koa'
import GameChannel from '../../../entities/game-channel'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { GameRouteState } from '../../../middleware/game-middleware'

type GameChannelRouteContext = ProtectedRouteContext<
  GameRouteState & { channel: GameChannel }
>

export async function loadChannel(ctx: GameChannelRouteContext, next: Next) {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const channel = await em.repo(GameChannel).findOne(Number(id), {
    populate: ['members']
  })

  if (!channel) {
    ctx.throw(404, 'Game channel not found')
  }

  ctx.state.channel = channel
  await next()
}
