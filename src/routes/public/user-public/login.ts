import { publicRoute } from '../../../lib/routing/router'
import User from '../../../entities/user'
import bcrypt from 'bcrypt'
import { buildTokenPair } from '../../../lib/auth/buildTokenPair'
import { setUserLastSeenAt } from '../../../lib/users/setUserLastSeenAt'

export const loginRoute = publicRoute({
  method: 'post',
  path: '/login',
  schema: (z) => ({
    body: z.object({
      email: z.string().min(1),
      password: z.string().min(1)
    })
  }),
  handler: async (ctx) => {
    const { email, password } = ctx.state.validated.body
    const em = ctx.em
    const redis = ctx.redis

    const user = await em.repo(User).findOne({ email }, { populate: ['organisation.games'] })
    if (!user) {
      return {
        status: 401,
        body: { message: 'Incorrect email address or password' }
      }
    }

    const passwordMatches = await bcrypt.compare(password, user.password)
    if (!passwordMatches) {
      return {
        status: 401,
        body: { message: 'Incorrect email address or password' }
      }
    }

    if (user.twoFactorAuth?.enabled) {
      await redis.set(`2fa:${user.id}`, 'true', 'EX', 300)

      return {
        status: 200,
        body: {
          twoFactorAuthRequired: true,
          userId: user.id
        }
      }
    }

    const userAgent = ctx.get('user-agent')
    const accessToken = await buildTokenPair({ em, ctx, user, userAgent })
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
