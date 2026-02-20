import { Next } from 'koa'
import Player from '../../../entities/player'
import { APIRouteContext } from '../../../lib/routing/context'

export type PlayerRouteState = {
  player: Player
}

async function fetchPlayer(ctx: APIRouteContext<PlayerRouteState>, loadAliases = false) {
  const { id } = ctx.params
  const key = ctx.state.key

  const player = await ctx.em.repo(Player).findOne(
    {
      id,
      game: key.game,
    },
    { populate: loadAliases ? ['aliases'] : undefined },
  )

  if (!player) {
    return ctx.throw(404, 'Player not found')
  }

  return player
}

export async function loadPlayer(ctx: APIRouteContext<PlayerRouteState>, next: Next) {
  ctx.state.player = await fetchPlayer(ctx)
  await next()
}

export async function loadPlayerWithAliases(ctx: APIRouteContext<PlayerRouteState>, next: Next) {
  ctx.state.player = await fetchPlayer(ctx, true)
  await next()
}
