import { raw } from '@mikro-orm/mysql'
import { endOfDay, startOfDay } from 'date-fns'
import { millisecondsInDay } from 'date-fns/constants'
import Player from '../../../entities/player'
import { calculateChange } from '../../../lib/math/calculateChange'
import { withResponseCache } from '../../../lib/perf/responseCache'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { dateRangeSchema } from '../../../lib/validation/dateRangeSchema'
import { loadGame } from '../../../middleware/game-middleware'

type PlayerCountData = {
  date: number
  count: number
  change: number
}

function fillDateGaps(data: PlayerCountData[], startDateQuery: string, endDateQuery: string) {
  const startDateMs = startOfDay(new Date(startDateQuery)).getTime()
  const endDateMs = startOfDay(new Date(endDateQuery)).getTime()

  const countsByDate = new Map(data.map((entry) => [entry.date, entry.count]))
  const filledData: PlayerCountData[] = []
  let prev: PlayerCountData | null = null

  for (
    let currentDateMs = startDateMs;
    currentDateMs <= endDateMs;
    currentDateMs += millisecondsInDay
  ) {
    const count = countsByDate.get(currentDateMs) ?? 0
    const entry: PlayerCountData = {
      date: currentDateMs,
      count,
      change: calculateChange(count, prev?.count ?? 0),
    }

    filledData.push(entry)
    prev = entry
  }

  return filledData
}

export const newPlayersRoute = protectedRoute({
  method: 'get',
  path: '/new-players',
  schema: () => ({
    query: dateRangeSchema,
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { startDate, endDate } = ctx.state.validated.query
    const game = ctx.state.game
    const includeDevData = ctx.state.includeDevData

    return withResponseCache(
      {
        key: `new-players-chart-${game.id}-${includeDevData}-${startDate}-${endDate}`,
      },
      async () => {
        const em = ctx.em

        const qb = em
          .qb(Player, 'p')
          .select([raw('DATE(p.created_at) as date_group'), raw('COUNT(*) as count')])
          .where({
            game,
            createdAt: {
              $gte: startOfDay(new Date(startDate)),
              $lte: endOfDay(new Date(endDate)),
            },
          })
          .groupBy(raw('date_group'))
          .orderBy({ [raw('date_group')]: 'asc' })

        if (!includeDevData) {
          qb.andWhere({ devBuild: false })
        }

        const results = await qb.execute<{ date_group: string; count: string }[]>()
        if (results.length === 0) {
          return {
            status: 200,
            body: {
              data: [],
            },
          }
        }

        const data: PlayerCountData[] = results.map((row) => ({
          date: new Date(row.date_group).getTime(),
          count: Number(row.count),
          change: 0,
        }))

        const filledData = fillDateGaps(data, startDate, endDate)

        return {
          status: 200,
          body: {
            data: filledData,
          },
        }
      },
    )
  },
})
