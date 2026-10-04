import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { updateGameConfigBodySchema } from '../../../lib/validation/routes/game-config/updateGameConfigBodySchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { updateGameConfigHandler } from '../../protected/game-config/update.js'
import { loadGameConfig } from './common.js'
import { updateDocs } from './docs.js'

export const updateGameConfigAdminRoute = adminRoute({
  method: 'patch',
  docs: updateDocs,
  schema: (z) => ({
    body: updateGameConfigBodySchema(z),
  }),
  middleware: withMiddleware(
    requireAdminScopes([AdminAPIKeyScope.WRITE_GAME_CONFIG]),
    loadGameConfig,
  ),
  handler: (ctx) =>
    updateGameConfigHandler({
      em: ctx.em,
      game: ctx.state.game,
      actor: ctx.state.key,
      props: ctx.state.validated.body.props,
      wss: ctx.wss,
    }),
})
