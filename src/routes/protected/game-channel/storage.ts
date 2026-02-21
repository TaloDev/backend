import { QueryOrder } from '@mikro-orm/mysql'
import GameChannelStorageProp from '../../../entities/game-channel-storage-prop'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { loadGame } from '../../../middleware/game-middleware'
import { loadChannel } from './common'

const itemsPerPage = DEFAULT_PAGE_SIZE

export const storageRoute = protectedRoute({
  method: 'get',
  path: '/:id/storage',
  schema: (z) => ({
    query: z.object({
      search: z.string().optional(),
      page: pageSchema,
    }),
  }),
  middleware: withMiddleware(loadGame, loadChannel),
  handler: async (ctx) => {
    const { search, page } = ctx.state.validated.query
    const em = ctx.em
    const channel = ctx.state.channel

    const [storageProps, count] = await em.repo(GameChannelStorageProp).findAndCount(
      {
        gameChannel: channel.id,
        ...(search
          ? {
              $or: [
                {
                  key: {
                    $like: `%${search}%`,
                  },
                },
                {
                  value: {
                    $like: `%${search}%`,
                  },
                },
                {
                  createdBy: {
                    identifier: {
                      $like: `%${search}%`,
                    },
                  },
                },
                {
                  lastUpdatedBy: {
                    identifier: {
                      $like: `%${search}%`,
                    },
                  },
                },
              ],
            }
          : {}),
      },
      {
        orderBy: {
          updatedAt: QueryOrder.DESC,
        },
        limit: itemsPerPage + 1,
        offset: Number(page) * itemsPerPage,
      },
    )

    return {
      status: 200,
      body: {
        channelName: channel.name,
        storageProps: storageProps.slice(0, itemsPerPage),
        count,
        itemsPerPage,
        isLastPage: storageProps.length <= itemsPerPage,
      },
    }
  },
})
