import { Next } from 'koa'
import Leaderboard from '../../../entities/leaderboard.js'
import { AdminAPIRouteContext } from '../../../lib/routing/context.js'

type AdminLeaderboardRouteState = {
  leaderboard: Leaderboard
}

export async function loadLeaderboard(
  ctx: AdminAPIRouteContext<AdminLeaderboardRouteState>,
  next: Next,
) {
  const { id } = ctx.params as { id: string }

  const leaderboard = await ctx.em.repo(Leaderboard).findOne({
    id: Number(id),
    game: ctx.state.game,
  })

  if (!leaderboard) {
    return ctx.throw(404, 'Leaderboard not found')
  }

  ctx.state.leaderboard = leaderboard
  await next()
}
