import PlayerAlias from '../../../entities/player-alias'
import { publicRoute, withMiddleware } from '../../../lib/routing/router'
import { verifyHandler } from '../../api/player-auth/verify'
import { buildPublicPlayerSession, loadGameFromToken } from './common'

export const verifyRoute = publicRoute({
  method: 'post',
  path: '/verify',
  schema: (z) => ({
    body: z.object({
      aliasId: z.number(),
      code: z.string(),
    }),
  }),
  middleware: withMiddleware(loadGameFromToken),
  handler: async (ctx) => {
    const { aliasId, code } = ctx.state.validated.body
    const { game } = ctx.state
    const em = ctx.em

    const alias = await em.repo(PlayerAlias).findOne(
      {
        id: aliasId,
        player: { game },
      },
      { populate: ['player.auth'] },
    )

    return verifyHandler({
      em,
      alias,
      code,
      redis: ctx.redis,
      ip: ctx.request.ip,
      userAgent: ctx.request.headers['user-agent'],
      sessionBuilder: buildPublicPlayerSession,
      createSocketToken: false,
    })
  },
})
