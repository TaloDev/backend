import { EntityManager, FilterQuery, ObjectQuery } from '@mikro-orm/mysql'
import { createHash } from 'crypto'
import { endOfDay, startOfDay } from 'date-fns'
import Leaderboard, { LeaderboardSortMode } from '../../../entities/leaderboard'
import LeaderboardEntry from '../../../entities/leaderboard-entry'
import Player from '../../../entities/player'
import PlayerAlias from '../../../entities/player-alias'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'
import { withResponseCache } from '../../../lib/perf/responseCache'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { loadGame } from '../../../middleware/game-middleware'
import { loadLeaderboard } from './common'

const itemsPerPage = DEFAULT_PAGE_SIZE

async function getGlobalEntryIds({
  em,
  aliasId,
  playerId,
  leaderboard,
  entries,
  includeDevData,
  includeDeleted,
}: {
  em: EntityManager
  includeDevData: boolean
  aliasId?: number
  playerId?: string
  leaderboard: Leaderboard
  entries: LeaderboardEntry[]
  includeDeleted: boolean
}) {
  if ((aliasId || playerId) && entries.length > 0) {
    const scores = entries.map((entry) => entry.score)
    const entryIds = entries.map((entry) => entry.id)
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)

    const globalQuery = em
      .qb(LeaderboardEntry)
      .select('id')
      .where({ leaderboard, hidden: false })
      .andWhere(includeDeleted ? {} : { deletedAt: null })
      .andWhere({
        $or: [
          // entries with better scores than the player's best
          {
            score:
              leaderboard.sortMode === LeaderboardSortMode.ASC
                ? { $lt: minScore }
                : { $gt: maxScore },
          },
          // entries tied within the player's score range
          {
            score: { $gte: minScore, $lte: maxScore },
          },
          // the player's own entries by id — guarantees inclusion even if the score
          // range misses them due to float decimal serialisation differences
          {
            id: { $in: entryIds },
          },
        ],
      })
      .orderBy({
        score: leaderboard.sortMode,
        createdAt: 'asc',
      })

    if (!includeDevData) {
      globalQuery.andWhere({
        playerAlias: {
          player: {
            devBuild: false,
          },
        },
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
  page: number
  aliasId?: number
  withDeleted?: boolean
  propKey?: string
  propValue?: string
  startDate?: string
  endDate?: string
  service?: string
  playerId?: string
}

export async function listEntriesHandler({
  em,
  leaderboard,
  includeDevData,
  forwarded,
  page,
  aliasId,
  withDeleted,
  propKey,
  propValue,
  startDate,
  endDate,
  service,
  playerId,
}: ListEntriesParams) {
  const argsDigest = createHash('sha256')
    .update(
      JSON.stringify({
        devDataComponent: includeDevData ? 'dev' : 'no-dev',
        forwarded,
        page,
        aliasId,
        withDeleted,
        propKey,
        propValue,
        startDate,
        endDate,
        service,
        playerId,
      }),
    )
    .digest('hex')

  const cacheKey = `${leaderboard.getEntriesCacheKey()}-${argsDigest}`

  return withResponseCache(
    {
      key: cacheKey,
      ttl: 600,
    },
    async () => {
      const includeDeleted = withDeleted === true

      const where: FilterQuery<LeaderboardEntry> = { leaderboard }

      if (!includeDeleted) {
        where.deletedAt = null
      }

      if (aliasId) {
        where.playerAlias = {
          id: aliasId,
        }
      }

      if (service) {
        where.playerAlias = {
          ...(where.playerAlias as ObjectQuery<PlayerAlias>),
          service,
        }
      }

      if (playerId) {
        where.playerAlias = {
          ...(where.playerAlias as ObjectQuery<PlayerAlias>),
          player: {
            id: playerId,
          },
        }
      }

      if (forwarded) {
        where.hidden = false
      }

      if (!includeDevData) {
        where.playerAlias = {
          ...(where.playerAlias as ObjectQuery<PlayerAlias>),
          player: {
            ...((where.playerAlias as ObjectQuery<PlayerAlias>)?.player as ObjectQuery<Player>),
            devBuild: false,
          },
        }
      }

      if (propKey) {
        if (propValue) {
          where.props = {
            $some: {
              key: propKey,
              value: propValue,
            },
          }
        } else {
          where.props = {
            $some: {
              key: propKey,
            },
          }
        }
      }

      if (startDate) {
        where.createdAt = {
          ...(where.createdAt as ObjectQuery<Date>),
          $gte: startOfDay(new Date(startDate)),
        }
      }

      if (endDate) {
        where.createdAt = {
          ...(where.createdAt as ObjectQuery<Date>),
          $lte: endOfDay(new Date(endDate)),
        }
      }

      const [entries, count] = await em.repo(LeaderboardEntry).findAndCount(where, {
        orderBy: {
          score: leaderboard.sortMode,
          createdAt: 'asc',
        },
        limit: itemsPerPage + 1,
        offset: page * itemsPerPage,
        populate: ['playerAlias'],
      })

      const globalEntryIds: number[] = await getGlobalEntryIds({
        em,
        aliasId,
        playerId,
        leaderboard,
        entries,
        includeDevData,
        includeDeleted,
      })

      const mappedEntries = await Promise.all(
        entries.slice(0, itemsPerPage).map(async (entry, idx) => {
          const position =
            aliasId || playerId ? globalEntryIds.indexOf(entry.id) : idx + page * itemsPerPage

          return {
            position,
            ...entry.toJSON(),
          }
        }),
      )

      return {
        status: 200,
        body: {
          entries: mappedEntries,
          count,
          itemsPerPage,
          isLastPage: entries.length <= itemsPerPage,
        },
      }
    },
  )
}

export const entriesRoute = protectedRoute({
  method: 'get',
  path: '/:id/entries',
  schema: (z) => ({
    query: z.object({
      page: pageSchema,
      aliasId: numericStringSchema.optional(),
      withDeleted: z
        .enum(['0', '1'])
        .optional()
        .transform((val) => val === '1'),
      propKey: z.string().optional(),
      propValue: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      service: z.string().optional(),
      playerId: z.uuid().optional(),
    }),
  }),
  middleware: withMiddleware(loadGame, loadLeaderboard()),
  handler: async (ctx) => {
    const {
      page,
      aliasId,
      withDeleted,
      propKey,
      propValue,
      startDate,
      endDate,
      service,
      playerId,
    } = ctx.state.validated.query

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
      service,
      playerId,
    })
  },
})
