import { protectedRouter, protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { loadGame } from '../../../middleware/game-middleware'
import { UserType } from '../../../entities/user'
import GameActivity from '../../../entities/game-activity'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { QueryOrder } from '@mikro-orm/mysql'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'

const itemsPerPage = DEFAULT_PAGE_SIZE

export function gameActivityRouter() {
  return protectedRouter('/games/:gameId/game-activities', ({ route }) => {
    route(protectedRoute({
      method: 'get',
      schema: (z) => ({
        query: z.object({
          page: pageSchema
        })
      }),
      middleware: withMiddleware(userTypeGate([UserType.ADMIN, UserType.DEMO], 'view game activities'), loadGame),
      handler: async (ctx) => {
        const em = ctx.em
        const game = ctx.state.game
        const { page } = ctx.state.validated.query

        const [allActivities, count] = await em.repo(GameActivity).findAndCount({
          $or: [
            { game },
            {
              $and: [
                {
                  game: null,
                  user: {
                    organisation: ctx.state.user.organisation
                  }
                }
              ]
            }
          ]
        }, {
          populate: ['user'],
          orderBy: { createdAt: QueryOrder.DESC },
          limit: itemsPerPage + 1,
          offset: page * itemsPerPage
        })

        const activities = allActivities.slice(0, itemsPerPage)

        return {
          status: 200,
          body: {
            activities,
            count,
            itemsPerPage,
            isLastPage: allActivities.length <= itemsPerPage
          }
        }
      }
    }))
  })
}
