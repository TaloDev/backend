import { APIKeyScope } from '../../../entities/api-key'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { requireScopes } from '../../../middleware/policy-middleware'
import { socketTokenDocs } from './docs'

export const socketTokenRoute = apiRoute({
  method: 'post',
  path: '/socket-token',
  docs: socketTokenDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
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
