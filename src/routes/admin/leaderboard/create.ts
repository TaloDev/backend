import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { createLeaderboardBodySchema } from '../../protected/leaderboard/common.js'
import { createLeaderboardHandler } from '../../protected/leaderboard/create.js'
import { createDocs } from './docs.js'

export const createLeaderboardAdminRoute = adminRoute({
  method: 'post',
  docs: createDocs,
  schema: (z) => ({
    body: createLeaderboardBodySchema(z),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.WRITE_LEADERBOARDS])),
  handler: (ctx) => {
    const { internalName, name, sortMode, unique, refreshInterval, uniqueByProps } =
      ctx.state.validated.body

    return createLeaderboardHandler({
      em: ctx.em,
      game: ctx.state.game,
      actor: ctx.state.key,
      internalName,
      name,
      sortMode,
      unique,
      refreshInterval,
      uniqueByProps,
    })
  },
})
