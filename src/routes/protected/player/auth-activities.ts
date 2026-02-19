import PlayerAuthActivity from '../../../entities/player-auth-activity'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import { loadPlayer } from './common'
import { loadGame } from '../../../middleware/game-middleware'
import PlayerAlias, { PlayerAliasService } from '../../../entities/player-alias'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { QueryOrder } from '@mikro-orm/mysql'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'

const itemsPerPage = DEFAULT_PAGE_SIZE

export const authActivitiesRoute = protectedRoute({
  method: 'get',
  path: '/:id/auth-activities',
  schema: (z) => ({
    query: z.object({
      page: pageSchema
    })
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'view player auth activities'),
    loadGame,
    loadPlayer
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const player = ctx.state.player
    const { page } = ctx.state.validated.query

    const hasTaloAlias = await em.repo(PlayerAlias).count({
      player,
      service: PlayerAliasService.TALO
    }) > 0

    if (!hasTaloAlias) {
      return {
        status: 200,
        body: {
          activities: [],
          count: 0,
          itemsPerPage,
          isLastPage: true
        }
      }
    }

    const [allActivities, count] = await em.repo(PlayerAuthActivity).findAndCount(
      { player },
      {
        orderBy: { createdAt: QueryOrder.DESC },
        limit: itemsPerPage + 1,
        offset: page * itemsPerPage
      }
    )

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
})
