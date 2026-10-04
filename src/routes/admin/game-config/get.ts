import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { getLiveConfigHandler } from '../../protected/game-config/get.js'
import { loadGameConfig } from './common.js'
import { getDocs } from './docs.js'

export const getGameConfigAdminRoute = adminRoute({
  method: 'get',
  docs: getDocs,
  middleware: withMiddleware(
    requireAdminScopes([AdminAPIKeyScope.READ_GAME_CONFIG]),
    loadGameConfig,
  ),
  handler: (ctx) => getLiveConfigHandler({ game: ctx.state.game }),
})
