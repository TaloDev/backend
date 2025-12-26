import { publicRoute } from '../../../lib/routing/router'
import User from '../../../entities/user'
import bcrypt from 'bcrypt'
import { buildTokenPair, updateLastSeenAt } from './common'

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
    const { email, password } = ctx.request.body
    const em = ctx.em
    const redis = ctx.redis

    const user = await em.getRepository(User).findOne({ email }, { populate: ['organisation.games'] })
    if (!user) {
      ctx.status = 401
      ctx.body = { message: 'Incorrect email address or password' }
      return
    }

    const passwordMatches = await bcrypt.compare(password, user.password)
    if (!passwordMatches) {
      ctx.status = 401
      ctx.body = { message: 'Incorrect email address or password' }
      return
    }

    if (user.twoFactorAuth?.enabled) {
      await redis.set(`2fa:${user.id}`, 'true', 'EX', 300)

      ctx.body = {
        twoFactorAuthRequired: true,
        userId: user.id
      }
      return
    }

    const accessToken = await buildTokenPair({ em, ctx, user, userAgent: ctx.get('user-agent') })
    await updateLastSeenAt({ em, user })

    ctx.body = {
      accessToken,
      user
    }
  }
})
