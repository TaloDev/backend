import { Next } from 'koa'
import { z } from 'zod'
import Leaderboard, {
  LeaderboardRefreshInterval,
  LeaderboardSortMode,
} from '../../../entities/leaderboard.js'
import { ProtectedRouteContext } from '../../../lib/routing/context.js'
import { GameRouteState } from '../../../middleware/game-middleware.js'

type LeaderboardRouteContext = ProtectedRouteContext<GameRouteState & { leaderboard: Leaderboard }>

const sortModeValues = Object.values(LeaderboardSortMode).join(', ')
const refreshIntervalValues = Object.values(LeaderboardRefreshInterval).join(', ')

export function createLeaderboardBodySchema(zod: typeof z) {
  return zod.object({
    internalName: zod.string().meta({ description: 'The internal name of the leaderboard' }),
    name: zod.string().meta({ description: 'The display name of the leaderboard' }),
    sortMode: zod
      .enum(LeaderboardSortMode, {
        error: `Sort mode must be one of ${sortModeValues}`,
      })
      .meta({ description: 'How entries are sorted: asc or desc' }),
    unique: zod.boolean().meta({
      description: 'Whether each player can only have a single entry',
    }),
    refreshInterval: zod
      .enum(LeaderboardRefreshInterval, {
        error: `Refresh interval must be one of ${refreshIntervalValues}`,
      })
      .optional()
      .meta({
        description: 'How often the leaderboard resets: never, daily, weekly, monthly or yearly',
      }),
    uniqueByProps: zod.boolean().optional().meta({
      description: 'Whether entries are unique based on their props',
    }),
  })
}

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
