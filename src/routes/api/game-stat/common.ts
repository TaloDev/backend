import { Next } from 'koa'
import GameStat from '../../../entities/game-stat'
import { APIRouteContext } from '../../../lib/routing/context'
import { PlayerAliasRouteState } from '../../../middleware/player-alias-middleware'
import { PlayerRouteState } from '../../../middleware/player-middleware'

export type GameStatRouteState = {
  stat: GameStat
}

async function fetchStat(ctx: APIRouteContext) {
  const { internalName } = ctx.params

  const stat = await ctx.em.repo(GameStat).findOne({
    internalName,
    game: ctx.state.game,
  })

  if (!stat) {
    return ctx.throw(404, 'Stat not found')
  }

  return stat
}

export async function loadStat(ctx: APIRouteContext<GameStatRouteState>, next: Next) {
  ctx.state.stat = await fetchStat(ctx)
  await next()
}

export async function loadStatWithPlayer(
  ctx: APIRouteContext<GameStatRouteState & PlayerRouteState>,
  next: Next,
) {
  ctx.state.stat = await fetchStat(ctx)
  await next()
}

export async function loadStatWithAlias(
  ctx: APIRouteContext<GameStatRouteState & PlayerAliasRouteState>,
  next: Next,
) {
  ctx.state.stat = await fetchStat(ctx)
  await next()
}
