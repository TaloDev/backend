import { EntityManager } from '@mikro-orm/mysql'
import { z } from 'zod'
import AdminAPIKey from '../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import GameStat from '../../../entities/game-stat.js'
import User from '../../../entities/user.js'
import updateAllowedKeys from '../../../lib/entities/updateAllowedKeys.js'
import handleSQLError from '../../../lib/errors/handleSQLError.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadStat, updateStatBodySchema } from './common.js'

export async function updateStatHandler({
  em,
  stat,
  body,
  actor,
}: {
  em: EntityManager
  stat: GameStat
  body: z.infer<ReturnType<typeof updateStatBodySchema>>
  actor: User | AdminAPIKey
}) {
  const [, changedProperties] = updateAllowedKeys(stat, body, [
    'name',
    'global',
    'maxChange',
    'minValue',
    'maxValue',
    'defaultValue',
    'minTimeBetweenUpdates',
  ])

  createGameActivity(em, {
    actor,
    game: stat.game,
    type: GameActivityType.GAME_STAT_UPDATED,
    extra: {
      statInternalName: stat.internalName,
      display: {
        'Updated properties': changedProperties
          .map((prop) => `${prop}: ${body[prop as keyof typeof body]}`)
          .join(', '),
      },
    },
  })

  try {
    await em.flush()
  } catch (err) {
    return handleSQLError(err as Error)
  }

  await deferClearResponseCache(GameStat.getIndexCacheKey(stat.game, true))

  return {
    status: 200,
    body: {
      stat,
    },
  }
}

export const updateRoute = protectedRoute({
  method: 'put',
  path: '/:id',
  schema: (z) => ({
    body: updateStatBodySchema(z),
  }),
  middleware: withMiddleware(loadStat),
  handler: async (ctx) => {
    return updateStatHandler({
      em: ctx.em,
      stat: ctx.state.stat,
      body: ctx.state.validated.body,
      actor: ctx.state.user,
    })
  },
})
