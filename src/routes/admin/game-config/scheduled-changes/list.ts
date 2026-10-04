import { AdminAPIKeyScope } from '../../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../../middleware/policy-middleware.js'
import { listScheduledGameConfigChangesHandler } from '../../../protected/game-config/scheduled-changes/list.js'
import { listScheduledChangesDocs } from '../docs.js'

export const listScheduledChangesAdminRoute = adminRoute({
  method: 'get',
  path: '/scheduled-changes',
  docs: listScheduledChangesDocs,
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.READ_GAME_CONFIG])),
  handler: (ctx) =>
    listScheduledGameConfigChangesHandler({
      em: ctx.em,
      game: ctx.state.game,
    }),
})
