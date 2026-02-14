import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { EntityManager, FilterQuery, QueryOrder } from '@mikro-orm/mysql'
import Game from '../../../entities/game'
import Player from '../../../entities/player'
import { withResponseCache } from '../../../lib/perf/responseCache'
import { SMALL_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'

type SearchPlayersParams = {
  em: EntityManager
  game: Game
  search?: string
  page: number
  includeDevData: boolean
  forwarded?: boolean
}

const itemsPerPage = SMALL_PAGE_SIZE

export async function listPlayersHandler({
  em,
  game,
  search,
  page,
  includeDevData,
  forwarded
}: SearchPlayersParams) {
  const searchComponent = search ? encodeURIComponent(search) : 'no-search'
  const devDataComponent = includeDevData ? 'dev' : 'no-dev'
  const cacheKey = `${Player.getSearchCacheKey(game)}-${searchComponent}-${page}-${devDataComponent}`

  return withResponseCache({ key: cacheKey, ttl: 5 }, async () => {
    const where: FilterQuery<Player> = { game }

    if (!includeDevData) {
      where.devBuild = false
    }

    if (search) {
      const searchConditions: FilterQuery<Player>[] = [
        {
          props: {
            $some: {
              value: {
                $like: `%${search}%`
              }
            }
          }
        },
        {
          aliases: {
            identifier: {
              $like: `%${search}%`
            }
          }
        },
        {
          id: {
            $like: `%${search}%`
          }
        }
      ]

      if (!forwarded) {
        const splitSearch = search.split(' ')
        const groupFilters = splitSearch.filter((part) => part.startsWith('group:'))
        const channelFilters = splitSearch.filter((part) => part.startsWith('channel:'))

        for (const filter of groupFilters) {
          const groupId = filter.split(':')[1]
          if (groupId) {
            searchConditions.push({
              groups: {
                $some: groupId
              }
            })
          }
        }

        for (const filter of channelFilters) {
          const channelId = Number(filter.split(':')[1])
          if (channelId && !isNaN(channelId)) {
            searchConditions.push({
              aliases: {
                channels: {
                  $some: channelId
                }
              }
            })
          }
        }
      }

      where.$or = searchConditions
    }

    const [allPlayers, count] = await em.repo(Player).findAndCount(where, {
      orderBy: { lastSeenAt: QueryOrder.DESC },
      limit: itemsPerPage + 1,
      offset: page * itemsPerPage
    })

    const players = allPlayers.slice(0, itemsPerPage)
    await em.populate(players, ['aliases'])

    return {
      status: 200,
      body: {
        players,
        count,
        itemsPerPage,
        isLastPage: allPlayers.length <= itemsPerPage
      }
    }
  })
}

export const listRoute = protectedRoute({
  method: 'get',
  schema: (z) => ({
    query: z.object({
      search: z.string().optional(),
      page: pageSchema
    })
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { search, page } = ctx.state.validated.query

    return listPlayersHandler({
      em: ctx.em,
      game: ctx.state.game,
      search,
      page,
      includeDevData: ctx.state.includeDevData
    })
  }
})
