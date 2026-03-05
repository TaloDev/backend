import PlayerAlias from '../../../entities/player-alias'
import { publicRoute, withMiddleware } from '../../../lib/routing/router'
import { sessionHeaderSchema } from '../../../lib/validation/sessionHeaderSchema'
import { throwInvalidSessionError } from '../../../middleware/player-auth-middleware'
import { deleteHandler } from '../../api/player-auth/delete'
import { loadGameFromToken, verifyPublicPlayerSession } from './common'

export const deleteRoute = publicRoute({
  method: 'delete',
  schema: (z) => ({
    body: z.object({
      sessionToken: sessionHeaderSchema,
    }),
  }),
  middleware: withMiddleware(loadGameFromToken),
  handler: async (ctx) => {
    const { sessionToken } = ctx.state.validated.body
    const { game } = ctx.state
    const em = ctx.em

    const session = await verifyPublicPlayerSession(sessionToken)
    if (!session) {
      return throwInvalidSessionError(ctx)
    }

    const alias = await em.repo(PlayerAlias).findOne(
      {
        id: session.aliasId,
        player: { id: session.playerId, game },
      },
      { populate: ['player.auth'] },
    )

    if (!alias) {
      return throwInvalidSessionError(ctx)
    }

    if (!alias.player.auth) {
      return ctx.throw(400, 'Player does not have authentication')
    }

    return deleteHandler({
      em,
      alias,
      ip: ctx.request.ip,
      userAgent: ctx.request.headers['user-agent'],
      selfService: true,
    })
  },
})
