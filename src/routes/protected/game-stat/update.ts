import { GameActivityType } from '../../../entities/game-activity.js'
import updateAllowedKeys from '../../../lib/entities/updateAllowedKeys.js'
import handleSQLError from '../../../lib/errors/handleSQLError.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { clearStatIndexResponseCache, loadStat, updateStatBodySchema } from './common.js'

export const updateRoute = protectedRoute({
  method: 'put',
  path: '/:id',
  schema: (z) => ({
    body: updateStatBodySchema(z),
  }),
  middleware: withMiddleware(loadStat, clearStatIndexResponseCache),
  handler: async (ctx) => {
    const em = ctx.em
    const body = ctx.state.validated.body

    const [stat, changedProperties] = updateAllowedKeys(ctx.state.stat, body, [
      'name',
      'global',
      'maxChange',
      'minValue',
      'maxValue',
      'defaultValue',
      'minTimeBetweenUpdates',
    ])

    createGameActivity(em, {
      user: ctx.state.user,
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

    return {
      status: 200,
      body: {
        stat,
      },
    }
  },
})
