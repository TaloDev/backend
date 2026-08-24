import { EntityManager } from '@mikro-orm/mysql'
import AdminAPIKey from '../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import GameStat from '../../../entities/game-stat.js'
import User, { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadStat } from './common.js'

export async function deleteStatHandler({
  em,
  stat,
  actor,
}: {
  em: EntityManager
  stat: GameStat
  actor: User | AdminAPIKey
}) {
  createGameActivity(em, {
    actor,
    game: stat.game,
    type: GameActivityType.GAME_STAT_DELETED,
    extra: {
      statInternalName: stat.internalName,
    },
  })

  await em.remove(stat).flush()
  await deferClearResponseCache(GameStat.getIndexCacheKey(stat.game, true))

  return {
    status: 204,
  }
}

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'delete stats'), loadStat),
  handler: async (ctx) => {
    return deleteStatHandler({
      em: ctx.em,
      stat: ctx.state.stat,
      actor: ctx.state.user,
    })
  },
})
