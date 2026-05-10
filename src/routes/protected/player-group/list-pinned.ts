import PlayerGroup from '../../../entities/player-group.js'
import UserPinnedGroup from '../../../entities/user-pinned-group.js'
import { withResponseCache } from '../../../lib/perf/responseCache.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'

export const listPinnedRoute = protectedRoute({
  method: 'get',
  path: '/pinned',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const em = ctx.em
    const user = ctx.state.user

    return withResponseCache(
      {
        key: UserPinnedGroup.getCacheKeyForUser(user),
        ttl: 600,
      },
      async () => {
        const pinnedGroups = await em.repo(UserPinnedGroup).find(
          {
            user,
            group: {
              game: ctx.state.game,
            },
          },
          {
            orderBy: { createdAt: 'desc' },
          },
        )

        const counts = await PlayerGroup.getManyCounts({
          em,
          groupIds: pinnedGroups.map(({ group }) => group.id),
          includeDevData: ctx.state.includeDevData,
        })

        const groups = pinnedGroups.map(({ group }) => group.toJSONWithCount(counts))

        return {
          status: 200,
          body: {
            groups,
          },
        }
      },
    )
  },
})
