import { Next } from 'koa'
import PlayerAlias from '../entities/player-alias'
import { APIRouteContext } from '../lib/routing/context'

export type PlayerAliasRouteState = {
  alias: PlayerAlias
}

export const loadAlias = async (ctx: APIRouteContext<PlayerAliasRouteState>, next: Next) => {
  const playerAlias = await ctx.em.repo(PlayerAlias).findOne({
    id: ctx.state.currentAliasId,
    player: {
      game: ctx.state.game
    }
  })

  if (!playerAlias) {
    ctx.throw(404, 'Player not found')
  }

  ctx.state.alias = playerAlias

  await next()
}
