import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { resetModes } from '../../../lib/validation/resetModeValidation.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { resetStatHandler } from '../../protected/game-stat/reset.js'
import { loadStat } from './common.js'
import { resetDocs } from './docs.js'

export const resetStatAdminRoute = adminRoute({
  method: 'delete',
  path: '/:id/player-stats',
  docs: resetDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the stat' }),
    }),
    query: z.object({
      mode: z
        .enum(resetModes, {
          error: `Mode must be one of: ${resetModes.join(', ')}`,
        })
        .optional()
        .default('all')
        .meta({ description: 'Which players to reset: all, live or dev' }),
    }),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.WRITE_STATS]), loadStat),
  handler: (ctx) => {
    const { mode } = ctx.state.validated.query

    return resetStatHandler({
      em: ctx.em,
      stat: ctx.state.stat,
      actor: ctx.state.key,
      mode,
      clickhouse: ctx.clickhouse,
      redis: ctx.redis,
    })
  },
})
