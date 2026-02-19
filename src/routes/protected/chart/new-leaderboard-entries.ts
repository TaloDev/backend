import { endOfDay, startOfDay } from 'date-fns'
import { millisecondsInDay } from 'date-fns/constants'
import { raw } from '@mikro-orm/mysql'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { dateRangeSchema } from '../../../lib/validation/dateRangeSchema'
import { calculateChange } from '../../../lib/math/calculateChange'
import { withResponseCache } from '../../../lib/perf/responseCache'
import LeaderboardEntry from '../../../entities/leaderboard-entry'
import Leaderboard from '../../../entities/leaderboard'
import assert from 'node:assert'

type LeaderboardValues = {
  [key: string]: number
}

type LeaderboardCountData = {
  date: number
  leaderboards: LeaderboardValues
  change: LeaderboardValues
}

function buildDataWithChanges(
  data: Map<number, LeaderboardValues>,
  startDateQuery: string,
  endDateQuery: string,
  leaderboardNames: string[]
): LeaderboardCountData[] {
  const startDateMs = startOfDay(new Date(startDateQuery)).getTime()
  const endDateMs = startOfDay(new Date(endDateQuery)).getTime()

  const result: LeaderboardCountData[] = []
  let prev: LeaderboardValues = {}

  for (let currentDateMs = startDateMs; currentDateMs <= endDateMs; currentDateMs += millisecondsInDay) {
    const leaderboards = data.get(currentDateMs) ?? {}
    const change: LeaderboardValues = {}

    for (const name of leaderboardNames) {
      change[name] = calculateChange(leaderboards[name] ?? 0, prev[name] ?? 0)
    }

    result.push({ date: currentDateMs, leaderboards, change })
    prev = leaderboards
  }

  return result
}

export const newLeaderboardEntriesRoute = protectedRoute({
  method: 'get',
  path: '/new-leaderboard-entries',
  schema: () => ({
    query: dateRangeSchema
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { startDate: startDateQuery, endDate: endDateQuery } = ctx.state.validated.query
    const game = ctx.state.game
    const includeDevData = ctx.state.includeDevData

    return withResponseCache({
      key: `new-leaderboard-entries-${game.id}-${includeDevData}-${startDateQuery}-${endDateQuery}`
    }, async () => {
      const em = ctx.em
      const leaderboardsForGame = await em.repo(Leaderboard).find({ game })

      const leaderboardIdToName = new Map<number, string>()
      for (const leaderboard of leaderboardsForGame) {
        leaderboardIdToName.set(leaderboard.id, leaderboard.internalName)
      }

      const leaderboardIds = Array.from(leaderboardIdToName.keys())
      if (leaderboardIds.length === 0) {
        return {
          status: 200,
          body: {
            data: [] as LeaderboardCountData[],
            leaderboardNames: [] as string[]
          }
        }
      }

      const qb = em.qb(LeaderboardEntry, 'le')
        .select([
          raw('le.leaderboard_id as leaderboard'),
          raw('DATE(le.created_at) as date_group'),
          raw('COUNT(*) as count')
        ])
        .where({
          leaderboard: { $in: leaderboardIds },
          createdAt: {
            $gte: startOfDay(new Date(startDateQuery)),
            $lte: endOfDay(new Date(endDateQuery))
          }
        })
        .groupBy([raw('leaderboard'), raw('date_group')])
        .orderBy({ [raw('leaderboard')]: 'asc', [raw('date_group')]: 'asc' })

      if (!includeDevData) {
        qb.andWhere({
          playerAlias: {
            player: {
              devBuild: false
            }
          }
        })
      }

      const results = await qb.execute<{
        leaderboard: string
        date_group: string
        count: string
      }[]>()

      const leaderboardsMap = new Map<number, LeaderboardValues>()
      for (const row of results) {
        const leaderboardName = leaderboardIdToName.get(Number(row.leaderboard))
        assert(leaderboardName)

        const date = new Date(row.date_group).getTime()
        const existing = leaderboardsMap.get(date) ?? {}
        leaderboardsMap.set(date, {
          ...existing,
          [leaderboardName]: Number(row.count)
        })
      }

      const leaderboardNames = Array.from(leaderboardIdToName.values())
      const data = buildDataWithChanges(leaderboardsMap, startDateQuery, endDateQuery, leaderboardNames)

      return {
        status: 200,
        body: {
          data,
          leaderboardNames
        }
      }
    })
  }
})
