import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { resetModes } from '../../../lib/validation/resetModeValidation.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { resetStatHandler } from '../../protected/game-stat/reset.js'
import { loadStat } from './common.js'

export const resetStatAdminRoute = adminRoute({
  method: 'delete',
  path: '/:id/player-stats',
  schema: (z) => ({
    query: z.object({
      mode: z
        .enum(resetModes, {
          error: `Mode must be one of: ${resetModes.join(', ')}`,
        })
        .optional()
        .default('all'),
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
