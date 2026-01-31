import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import GameStat from '../../../entities/game-stat'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import handleSQLError from '../../../lib/errors/handleSQLError'
import { clearStatIndexResponseCache, createStatBodySchema } from './common'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse'

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: createStatBodySchema(z)
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN, UserType.DEV], 'create stats'),
    loadGame,
    clearStatIndexResponseCache
  ),
  handler: async (ctx) => {
    const { internalName, name, global, maxChange, minValue, maxValue, defaultValue, minTimeBetweenUpdates } = ctx.state.validated.body
    const em = ctx.em

    const existingStat = await em.repo(GameStat).findOne({
      internalName,
      game: ctx.state.game
    })

    if (existingStat) {
      return buildErrorResponse({
        internalName: [`A stat with the internalName '${internalName}' already exists`]
      })
    }

    const stat = new GameStat(ctx.state.game)
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
      user: ctx.state.user,
      game: stat.game,
      type: GameActivityType.GAME_STAT_CREATED,
      extra: {
        statInternalName: stat.internalName
      }
    })
    await em.flush()

    return {
      status: 200,
      body: {
        stat
      }
    }
  }
})
