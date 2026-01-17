import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { raw } from '@mikro-orm/mysql'
import { endOfDay, startOfDay } from 'date-fns'
import Player from '../../../entities/player'
import { getResultCacheOptions } from '../../../lib/perf/getResultCacheOptions'
import { HEADLINES_CACHE_TTL_MS } from './common'
import { dateRangeSchema } from '../../../lib/validation/dateRangeSchema'

export const returningPlayersRoute = protectedRoute({
  method: 'get',
  path: '/returning_players',
  schema: () => ({
    query: dateRangeSchema
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { startDate, endDate } = ctx.state.validated.query
    const em = ctx.em

    const game = ctx.state.game
    const includeDevData = ctx.state.includeDevData
    const count = await em.repo(Player).count({
      game,
      ...(includeDevData ? {} : { devBuild: false }),
      lastSeenAt: {
        $gte: startOfDay(new Date(startDate)),
        $lte: endOfDay(new Date(endDate))
      },
      createdAt: {
        $lt: startOfDay(new Date(startDate))
      },
      [raw('datediff(created_at, last_seen_at)')]: {
        $ne: 0
      }
    }, getResultCacheOptions(`returning-players-${game.id}-${includeDevData}-${startDate}-${endDate}`, HEADLINES_CACHE_TTL_MS))

    return {
      status: 200,
      body: {
        count
      }
    }
  }
})
