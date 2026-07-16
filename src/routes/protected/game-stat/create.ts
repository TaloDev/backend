import { EntityManager } from '@mikro-orm/mysql'
import { z } from 'zod'
import AdminAPIKey from '../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import GameStat from '../../../entities/game-stat.js'
import Game from '../../../entities/game.js'
import User, { UserType } from '../../../entities/user.js'
import { buildErrorResponse } from '../../../lib/errors/buildErrorResponse.js'
import handleSQLError from '../../../lib/errors/handleSQLError.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { createStatBodySchema } from './common.js'

export async function createStatHandler({
  em,
  game,
  actor,
  data,
}: {
  em: EntityManager
  game: Game
  actor: User | AdminAPIKey
  data: z.infer<ReturnType<typeof createStatBodySchema>>
}) {
  const {
    internalName,
    name,
    global,
    maxChange,
    minValue,
    maxValue,
    defaultValue,
    minTimeBetweenUpdates,
  } = data

  const existingStat = await em.repo(GameStat).findOne({ internalName, game })
  if (existingStat) {
    return buildErrorResponse({
      internalName: [`A stat with the internalName '${internalName}' already exists`],
    })
  }

  const stat = new GameStat(game)
  stat.internalName = internalName
  stat.name = name
  stat.global = global
  stat.globalValue = stat.defaultValue = defaultValue
  stat.maxChange = maxChange ?? null
  stat.minValue = minValue ?? null
  stat.maxValue = maxValue ?? null
  stat.minTimeBetweenUpdates = minTimeBetweenUpdates

  try {
    await em.persist(stat).flush()
  } catch (err) {
    return handleSQLError(err as Error)
  }

  createGameActivity(em, {
    actor,
    game: stat.game,
    type: GameActivityType.GAME_STAT_CREATED,
    extra: {
      statInternalName: stat.internalName,
    },
  })
  await em.flush()

  await deferClearResponseCache(GameStat.getIndexCacheKey(game, true))

  return {
    status: 200,
    body: { stat },
  }
}

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: createStatBodySchema(z),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN, UserType.DEV], 'create stats'),
    loadGame,
  ),
  handler: (ctx) => {
    return createStatHandler({
      em: ctx.em,
      game: ctx.state.game,
      actor: ctx.state.user,
      data: ctx.state.validated.body,
    })
  },
})
