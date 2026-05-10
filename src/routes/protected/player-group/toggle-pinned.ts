import UserPinnedGroup from '../../../entities/user-pinned-group.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { loadGroup } from './common.js'

export const togglePinnedRoute = protectedRoute({
  method: 'put',
  path: '/:id/toggle-pinned',
  schema: (z) => ({
    body: z.object({
      pinned: z.boolean(),
    }),
  }),
  middleware: withMiddleware(loadGame, loadGroup),
  handler: async (ctx) => {
    const { pinned } = ctx.state.validated.body
    const em = ctx.em
    const group = ctx.state.group
    const user = ctx.state.user

    const pinnedGroup = await em.repo(UserPinnedGroup).findOne({ user, group })
    if (pinned && !pinnedGroup) {
      em.persist(new UserPinnedGroup(user, group))
    } else if (!pinned && pinnedGroup) {
      em.remove(pinnedGroup)
    }

    await em.flush()
    await deferClearResponseCache(UserPinnedGroup.getCacheKeyForUser(user))

    return {
      status: 204,
    }
  },
})
