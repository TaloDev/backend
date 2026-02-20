import { Next } from 'koa'
import Leaderboard from '../../../entities/leaderboard'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { GameRouteState } from '../../../middleware/game-middleware'

type LeaderboardRouteContext = ProtectedRouteContext<GameRouteState & { leaderboard: Leaderboard }>

export function loadLeaderboard(withEntries: boolean = false) {
  return async (ctx: LeaderboardRouteContext, next: Next) => {
    const { id } = ctx.params as { id: string }
    const em = ctx.em

    const leaderboard = await em.repo(Leaderboard).findOne(
      {
        id: Number(id),
        game: ctx.state.game,
      },
      { populate: withEntries ? ['entries'] : [] },
    )

    if (!leaderboard) {
      return ctx.throw(404, 'Leaderboard not found')
    }

    ctx.state.leaderboard = leaderboard
    await next()
  }
}
