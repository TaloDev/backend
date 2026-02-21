import { QueryOrder, EntityManager } from '@mikro-orm/mysql'
import Game from '../../../entities/game'
import GameChannel from '../../../entities/game-channel'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'
import { withResponseCache } from '../../../lib/perf/responseCache'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { loadGame } from '../../../middleware/game-middleware'

const itemsPerPage = DEFAULT_PAGE_SIZE

type ListChannelsParams = {
  em: EntityManager
  game: Game
  includeDevData: boolean
  forwarded?: boolean
  search?: string
  page?: number
  propKey?: string
  propValue?: string
}

export async function listChannelsHandler({
  em,
  game,
  includeDevData,
  forwarded,
  search,
  page = 0,
  propKey,
  propValue,
}: ListChannelsParams) {
  const searchComponent = search ? encodeURIComponent(search) : 'no-search'
  const cacheKey = `${GameChannel.getSearchCacheKey(game)}-${searchComponent}-${page}-${propKey}-${propValue}`

  return withResponseCache(
    {
      key: cacheKey,
      ttl: 600,
    },
    async () => {
      const query = em
        .qb(GameChannel, 'gc')
        .select('gc.*')
        .orderBy({ totalMessages: QueryOrder.DESC })
        .limit(itemsPerPage + 1)
        .offset(Number(page) * itemsPerPage)

      if (search) {
        query.andWhere({
          $or: [
            { name: { $like: `%${search}%` } },
            {
              owner: { identifier: { $like: `%${search}%` } },
            },
          ],
        })
      }

      if (forwarded) {
        query.andWhere({
          private: false,
        })
      }

      if (propKey) {
        if (propValue) {
          query.andWhere({
            props: {
              $some: {
                key: propKey,
                value: propValue,
              },
            },
          })
        } else {
          query.andWhere({
            props: {
              $some: {
                key: propKey,
              },
            },
          })
        }
      }

      const [channels, count] = await query.andWhere({ game }).getResultAndCount()

      await em.populate(channels, ['owner'])

      const channelPromises = channels
        .slice(0, itemsPerPage)
        .map((channel) => channel.toJSONWithCount(includeDevData))

      return {
        status: 200,
        body: {
          channels: await Promise.all(channelPromises),
          count,
          itemsPerPage,
          isLastPage: channels.length <= itemsPerPage,
        },
      }
    },
  )
}

export const listRoute = protectedRoute({
  method: 'get',
  schema: (z) => ({
    query: z.object({
      search: z.string().optional(),
      page: pageSchema,
      propKey: z.string().optional(),
      propValue: z.string().optional(),
    }),
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { search, page, propKey, propValue } = ctx.state.validated.query

    return listChannelsHandler({
      em: ctx.em,
      game: ctx.state.game,
      includeDevData: ctx.state.includeDevData,
      search,
      page,
      propKey,
      propValue,
    })
  },
})
