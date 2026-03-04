import PlayerAlias, { PlayerAliasService } from '../../../entities/player-alias'
import { publicRoute, withMiddleware } from '../../../lib/routing/router'
import { loginHandler } from '../../api/player-auth/login'
import { buildPublicPlayerSession, loadGameFromToken } from './common'

export const loginRoute = publicRoute({
  method: 'post',
  path: '/login',
  schema: (z) => ({
    body: z.object({
      identifier: z.string(),
      password: z.string(),
    }),
  }),
  middleware: withMiddleware(loadGameFromToken),
  handler: async (ctx) => {
    const { identifier, password } = ctx.state.validated.body
    const { game } = ctx.state
    const em = ctx.em

    const alias = await em.repo(PlayerAlias).findOne({
      service: PlayerAliasService.TALO,
      identifier: identifier.trim(),
      player: { game },
    })

    return loginHandler({
      em,
      alias,
      password,
      redis: ctx.redis,
      ip: ctx.request.ip,
      userAgent: ctx.request.headers['user-agent'],
      sessionBuilder: buildPublicPlayerSession,
      createSocketToken: false,
    })
  },
})
