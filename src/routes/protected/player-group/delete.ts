import { GameActivityType } from '../../../entities/game-activity.js'
import PlayerGroup from '../../../entities/player-group.js'
import UserPinnedGroup from '../../../entities/user-pinned-group.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadGroup } from './common.js'

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN, UserType.DEV], 'delete groups'),
    loadGame,
    loadGroup,
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const group = ctx.state.group

    createGameActivity(em, {
      user: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.PLAYER_GROUP_DELETED,
      extra: {
        groupName: group.name,
      },
    })

    const userPinnedGroups = await em.repo(UserPinnedGroup).find({ group })
    em.remove(userPinnedGroups)

    // delete the response cache for all users who pinned this group
    await Promise.allSettled(
      userPinnedGroups.map(({ user }) => {
        return deferClearResponseCache(UserPinnedGroup.getCacheKeyForUser(user))
      }),
    )

    await em.remove(group).flush()
    await em.clearCache(PlayerGroup.getCacheKey(ctx.state.game))

    return {
      status: 204,
    }
  },
})
