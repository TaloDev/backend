import { publicRoute } from '../../../lib/routing/router'
import User from '../../../entities/user'
import { authenticator } from '@otplib/preset-default'
import { buildTokenPair, updateLastSeenAt } from './common'

export const verify2faRoute = publicRoute({
  method: 'post',
  path: '/2fa',
  schema: (z) => ({
    body: z.object({
      code: z.string().min(1),
      userId: z.number()
    })
  }),
  handler: async (ctx) => {
    const { code, userId } = ctx.request.body
    const em = ctx.em
    const redis = ctx.redis

    const user = await em.repo(User).findOneOrFail(userId, { populate: ['organisation.games'] })

    const hasSession = (await redis.get(`2fa:${user.id}`)) === 'true'

    if (!hasSession) {
      ctx.status = 403
      ctx.body = { message: 'Session expired', sessionExpired: true }
      return
    }

    if (!authenticator.check(code, user.twoFactorAuth!.secret)) {
      ctx.status = 403
      ctx.body = { message: 'Invalid code' }
      return
    }

    const accessToken = await buildTokenPair({ em, ctx, user, userAgent: ctx.get('user-agent') })
    await redis.del(`2fa:${user.id}`)
    await updateLastSeenAt({ em, user })

    ctx.body = {
      accessToken,
      user
    }
  }
})
