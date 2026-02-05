import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { createPlayerAuthActivity, loadAliasWithAuth } from './common'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { sessionHeaderSchema } from '../../../lib/validation/sessionHeaderSchema'
import { logoutDocs } from './docs'

export const logoutRoute = apiRoute({
  method: 'post',
  path: '/logout',
  docs: logoutDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
      'x-talo-alias': playerAliasHeaderSchema,
      'x-talo-session': sessionHeaderSchema
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS]),
    loadAliasWithAuth
  ),
  handler: async (ctx) => {
    const em = ctx.em

    const alias = ctx.state.alias
    if (!alias.player.auth) {
      return ctx.throw(400, 'Player does not have authentication')
    }

    alias.player.auth.clearSession()

    createPlayerAuthActivity(ctx, alias.player, {
      type: PlayerAuthActivityType.LOGGED_OUT
    })

    await em.flush()

    return {
      status: 204
    }
  }
})
