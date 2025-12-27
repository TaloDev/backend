import { publicRoute } from '../../../lib/routing/router'
import User from '../../../entities/user'
import { authenticator } from '@otplib/preset-default'
import { buildTokenPair } from '../../../lib/auth/buildTokenPair'
import { setUserLastSeenAt } from '../../../lib/users/setUserLastSeenAt'

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
    const { code, userId } = ctx.state.validated.body
    const em = ctx.em
    const redis = ctx.redis

    const user = await em.repo(User).findOneOrFail(userId, { populate: ['organisation.games'] })

    const hasSession = (await redis.get(`2fa:${user.id}`)) === 'true'

    if (!hasSession) {
      return {
        status: 403,
        body: { message: 'Session expired', sessionExpired: true }
      }
    }

    if (!authenticator.check(code, user.twoFactorAuth!.secret)) {
      return {
        status: 403,
        body: { message: 'Invalid code' }
      }
    }

    const accessToken = await buildTokenPair({ em, ctx, user, userAgent: ctx.get('user-agent') })
    await redis.del(`2fa:${user.id}`)
    await setUserLastSeenAt({ em, user })

    return {
      status: 200,
      body: {
        accessToken,
        user
      }
    }
  }
})
