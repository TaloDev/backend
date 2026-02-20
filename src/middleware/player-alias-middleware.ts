import { Next } from 'koa'
import PlayerAlias from '../entities/player-alias'
import { APIRouteContext } from '../lib/routing/context'

export type PlayerAliasRouteState = {
  alias: PlayerAlias
}

export async function loadAlias(ctx: APIRouteContext<PlayerAliasRouteState>, next: Next) {
  const playerAlias = await ctx.em.repo(PlayerAlias).findOne({
    id: ctx.state.currentAliasId,
    player: {
      game: ctx.state.game,
    },
  })

  if (!playerAlias) {
    return ctx.throw(404, 'Player not found')
  }

  ctx.state.alias = playerAlias

  await next()
}
