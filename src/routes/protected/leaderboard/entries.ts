import { EntityManager, FilterQuery, ObjectQuery } from '@mikro-orm/mysql'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import Leaderboard, { LeaderboardSortMode } from '../../../entities/leaderboard'
import LeaderboardEntry from '../../../entities/leaderboard-entry'
import PlayerAlias from '../../../entities/player-alias'
import { loadLeaderboard } from './common'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'
import { withResponseCache } from '../../../lib/perf/responseCache'
import { endOfDay, startOfDay } from 'date-fns'

const itemsPerPage = DEFAULT_PAGE_SIZE

async function getGlobalEntryIds({
  em,
  aliasId,
  leaderboard,
  entries,
  includeDevData,
  includeDeleted
}: {
  em: EntityManager
  includeDevData: boolean
  aliasId?: number
  leaderboard: Leaderboard
  entries: LeaderboardEntry[]
  includeDeleted: boolean
}): Promise<number[]> {
  if (aliasId && entries.length > 0) {
    const scores = entries.map((entry) => entry.score)
    const globalQuery = em.qb(LeaderboardEntry)
      .select('id')
      .where({ leaderboard, hidden: false })
      .andWhere(includeDeleted ? {} : { deletedAt: null })
      .andWhere({
        $or: [
          // entries with better scores
          {
            score: leaderboard.sortMode === LeaderboardSortMode.ASC
              ? { $lt: Math.min(...scores) }
              : { $gt: Math.max(...scores) }
          },
          // entries with equal scores
          {
            score: { $in: scores }
          }
        ]
      })
      .orderBy({
        score: leaderboard.sortMode,
        createdAt: 'asc'
      })

    if (!includeDevData) {
      globalQuery.andWhere({
        playerAlias: {
          player: {
            devBuild: false
          }
        }
      })
    }

    return (await globalQuery.getResultList()).map((entry) => entry.id)
  }

  return []
}

type ListEntriesParams = {
  em: EntityManager
  leaderboard: Leaderboard
  includeDevData: boolean
  forwarded?: boolean
  page?: number
  aliasId?: number
  withDeleted?: boolean
  propKey?: string
  propValue?: string
  startDate?: string
  endDate?: string
  service?: string
}

export async function listEntriesHandler({
  em,
  leaderboard,
  includeDevData,
  forwarded,
  page = 0,
  aliasId,
  withDeleted,
  propKey,
  propValue,
  startDate,
  endDate,
  service
}: ListEntriesParams) {
  const includeDeleted = withDeleted === true

  const devDataComponent = includeDevData ? 'dev' : 'no-dev'
  const cacheKey = `${leaderboard.getEntriesCacheKey()}-${page}-${aliasId}-${withDeleted}-${propKey}-${propValue}-${startDate}-${endDate}-${service}-${devDataComponent}`

  return withResponseCache({
    key: cacheKey,
    ttl: 600
  }, async () => {
    const where: FilterQuery<LeaderboardEntry> = { leaderboard }

    if (!includeDeleted) {
      where.deletedAt = null
    }

    if (aliasId) {
      where.playerAlias = {
        id: aliasId
      }
    }

    if (service) {
      where.playerAlias = {
        ...((where.playerAlias as ObjectQuery<PlayerAlias>) ?? {}),
        service
      }
    }

    if (forwarded) {
      where.hidden = false
    }

    if (!includeDevData) {
      where.playerAlias = {
        ...((where.playerAlias as ObjectQuery<PlayerAlias>) ?? {}),
        player: {
          devBuild: false
        }
      }
    }

    if (propKey) {
      if (propValue) {
        where.props = {
          $some: {
            key: propKey,
            value: propValue
          }
        }
      } else {
        where.props = {
          $some: {
            key: propKey
          }
        }
      }
    }

    if (startDate) {
      where.createdAt = {
        ...((where.createdAt as ObjectQuery<Date>) ?? {}),
        $gte: startOfDay(new Date(startDate))
      }
    }

    if (endDate) {
      where.createdAt = {
        ...((where.createdAt as ObjectQuery<Date>) ?? {}),
        $lte: endOfDay(new Date(endDate))
      }
    }

    const [entries, count] = await em.repo(LeaderboardEntry).findAndCount(where, {
      orderBy: {
        score: leaderboard.sortMode,
        createdAt: 'asc'
      },
      limit: itemsPerPage + 1,
      offset: page * itemsPerPage,
      populate: ['playerAlias']
    })

    const globalEntryIds: number[] = await getGlobalEntryIds({
      em,
      aliasId,
      leaderboard,
      entries,
      includeDevData,
      includeDeleted
    })

    const mappedEntries = await Promise.all(entries.slice(0, itemsPerPage).map(async (entry, idx) => {
      const position = aliasId
        ? globalEntryIds.indexOf(entry.id)
        : idx + (page * itemsPerPage)

      return {
        position,
        ...entry.toJSON()
      }
    }))

    return {
      status: 200,
      body: {
        entries: mappedEntries,
        count,
        itemsPerPage,
        isLastPage: entries.length <= itemsPerPage
      }
    }
  })
}

export const entriesRoute = protectedRoute({
  method: 'get',
  path: '/:id/entries',
  schema: (z) => ({
    query: z.object({
      page: z.coerce.number().int().min(0).optional(),
      aliasId: z.coerce.number().int().optional(),
      withDeleted: z.enum(['0', '1']).optional().transform((val) => val === '1'),
      propKey: z.string().optional(),
      propValue: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      service: z.string().optional()
    })
  }),
  middleware: withMiddleware(loadGame, loadLeaderboard()),
  handler: async (ctx) => {
    const { page, aliasId, withDeleted, propKey, propValue, startDate, endDate, service } = ctx.state.validated.query

    return listEntriesHandler({
      em: ctx.em,
      leaderboard: ctx.state.leaderboard,
      includeDevData: ctx.state.includeDevData,
      page,
      aliasId,
      withDeleted,
      propKey,
      propValue,
      startDate,
      endDate,
      service
    })
  }
})
