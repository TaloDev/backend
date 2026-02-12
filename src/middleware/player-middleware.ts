import { Next } from 'koa'
import Player from '../entities/player'
import { APIRouteContext } from '../lib/routing/context'

export type PlayerRouteState = {
  player: Player
  currentPlayerId?: string
}

export async function loadPlayer(ctx: APIRouteContext<PlayerRouteState>, next: Next) {
  const player = await ctx.em.repo(Player).findOne({
    id: ctx.state.currentPlayerId,
    game: ctx.state.game
  })

  if (!player) {
    return ctx.throw(404, 'Player not found')
  }

  ctx.state.player = player

  await next()
}
