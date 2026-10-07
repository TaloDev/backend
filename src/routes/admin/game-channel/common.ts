import { Next } from 'koa'
import GameChannel from '../../../entities/game-channel.js'
import { AdminAPIRouteContext } from '../../../lib/routing/context.js'

type AdminGameChannelRouteState = {
  channel: GameChannel
}

export async function loadChannel(
  ctx: AdminAPIRouteContext<AdminGameChannelRouteState>,
  next: Next,
) {
  const { id } = ctx.params as { id: string }

  const channel = await ctx.em.repo(GameChannel).findOne(
    {
      id: Number(id),
      game: ctx.state.game,
    },
    {
      populate: ['members'],
    },
  )

  if (!channel) {
    return ctx.throw(404, 'Game channel not found')
  }

  ctx.state.channel = channel
  await next()
}
