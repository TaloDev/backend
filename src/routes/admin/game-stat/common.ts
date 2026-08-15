import { Next } from 'koa'
import GameStat from '../../../entities/game-stat.js'
import { AdminAPIRouteContext } from '../../../lib/routing/context.js'

type AdminGameStatRouteState = {
  stat: GameStat
}

export async function loadStat(ctx: AdminAPIRouteContext<AdminGameStatRouteState>, next: Next) {
  const { id } = ctx.params as { id: string }

  const stat = await ctx.em.repo(GameStat).findOne({ id: Number(id), game: ctx.state.game })

  if (!stat) {
    return ctx.throw(404, 'Stat not found')
  }

  ctx.state.stat = stat
  await next()
}
