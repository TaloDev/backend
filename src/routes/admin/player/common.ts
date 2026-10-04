import { Next } from 'koa'
import Player from '../../../entities/player.js'
import { AdminAPIRouteContext } from '../../../lib/routing/context.js'

type AdminPlayerRouteState = {
  player: Player
}

export async function loadPlayer(ctx: AdminAPIRouteContext<AdminPlayerRouteState>, next: Next) {
  const { id } = ctx.params as { id: string }

  const player = await ctx.em.repo(Player).findOne(
    {
      id,
      game: ctx.state.game,
    },
    {
      populate: ['aliases', 'game'],
      strategy: 'joined',
    },
  )

  if (!player) {
    return ctx.throw(404, 'Player not found')
  }

  ctx.state.player = player
  await next()
}
