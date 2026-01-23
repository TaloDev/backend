import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import UserPinnedGroup from '../../../entities/user-pinned-group'
import { withResponseCache } from '../../../lib/perf/responseCache'

export const listPinnedRoute = protectedRoute({
  method: 'get',
  path: '/pinned',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const em = ctx.em
    const user = ctx.state.authenticatedUser

    return withResponseCache({
      key: UserPinnedGroup.getCacheKeyForUser(user),
      ttl: 600
    }, async () => {
      const pinnedGroups = await em.repo(UserPinnedGroup).find({
        user,
        group: {
          game: ctx.state.game
        }
      }, {
        orderBy: { createdAt: 'desc' }
      })

      const groups = await Promise.all(pinnedGroups.map(({ group }) => {
        return group.toJSONWithCount(ctx.state.includeDevData)
      }))

      return {
        status: 200,
        body: {
          groups
        }
      }
    })
  }
})
