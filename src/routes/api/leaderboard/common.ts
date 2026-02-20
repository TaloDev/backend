import { Next } from 'koa'
import Leaderboard from '../../../entities/leaderboard'
import { APIRouteContext } from '../../../lib/routing/context'
import { PlayerAliasRouteState } from '../../../middleware/player-alias-middleware'

export type LeaderboardRouteState = PlayerAliasRouteState & {
  leaderboard: Leaderboard
}

export async function loadLeaderboard(ctx: APIRouteContext<LeaderboardRouteState>, next: Next) {
  const { internalName } = ctx.params

  const leaderboard = await ctx.em.repo(Leaderboard).findOne({
    internalName,
    game: ctx.state.game,
  })

  if (!leaderboard) {
    return ctx.throw(404, 'Leaderboard not found')
  }

  ctx.state.leaderboard = leaderboard

  await next()
}
