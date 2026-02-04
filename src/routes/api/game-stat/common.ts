import GameStat from '../../../entities/game-stat'
import { PlayerRouteState } from '../../../middleware/player-middleware'
import { PlayerAliasRouteState } from '../../../middleware/player-alias-middleware'
import { APIRouteContext } from '../../../lib/routing/context'
import { Next } from 'koa'

export type GameStatRouteState = {
  stat: GameStat
  continuityDate?: Date
}

async function fetchStat(ctx: APIRouteContext) {
  const { internalName } = ctx.params

  const stat = await ctx.em.repo(GameStat).findOne({
    internalName,
    game: ctx.state.game
  })

  if (!stat) {
    ctx.throw(404, 'Stat not found')
  }

  return stat
}

export const loadStat = async (ctx: APIRouteContext<GameStatRouteState>, next: Next) => {
  ctx.state.stat = await fetchStat(ctx)
  await next()
}

export const loadStatWithPlayer = async (ctx: APIRouteContext<GameStatRouteState & PlayerRouteState>, next: Next) => {
  ctx.state.stat = await fetchStat(ctx)
  await next()
}

export const loadStatWithAlias = async (ctx: APIRouteContext<GameStatRouteState & PlayerAliasRouteState>, next: Next) => {
  ctx.state.stat = await fetchStat(ctx)
  await next()
}
