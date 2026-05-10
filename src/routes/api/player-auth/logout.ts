import { APIKeyScope } from '../../../entities/api-key.js'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema.js'
import { sessionHeaderSchema } from '../../../lib/validation/sessionHeaderSchema.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { createPlayerAuthActivity, loadAliasWithAuth } from './common.js'
import { logoutDocs } from './docs.js'

export const logoutRoute = apiRoute({
  method: 'post',
  path: '/logout',
  docs: logoutDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
      'x-talo-alias': playerAliasHeaderSchema,
      'x-talo-session': sessionHeaderSchema,
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS]),
    loadAliasWithAuth,
  ),
  handler: async (ctx) => {
    const em = ctx.em

    const alias = ctx.state.alias
    if (!alias.player.auth) {
      return ctx.throw(400, 'Player does not have authentication')
    }

    alias.player.auth.clearSession()

    createPlayerAuthActivity(ctx, alias.player, {
      type: PlayerAuthActivityType.LOGGED_OUT,
    })

    await em.flush()

    return {
      status: 204,
    }
  },
})
