import { APIKeyScope } from '../../../entities/api-key.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { playerAliasHeaders } from '../../../lib/validation/playerHeadersSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { socketTokenDocs } from './docs.js'

export const socketTokenRoute = apiRoute({
  method: 'post',
  path: '/socket-token',
  docs: socketTokenDocs,
  schema: () => ({
    headers: playerAliasHeaders,
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.WRITE_PLAYERS]), loadAlias),
  handler: async (ctx) => {
    const alias = ctx.state.alias
    const socketToken = await alias.createSocketToken(ctx.redis)

    return {
      status: 200,
      body: {
        socketToken,
      },
    }
  },
})
