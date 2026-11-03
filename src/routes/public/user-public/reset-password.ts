import bcrypt from 'bcrypt'
import UserSession from '../../../entities/user-session.js'
import User from '../../../entities/user.js'
import { getHashFingerprint, getResetTokenKey } from '../../../lib/auth/resetToken.js'
import { publicRoute } from '../../../lib/routing/router.js'
import { passwordSchema } from '../../../lib/validation/passwordSchema.js'

function expiredResponse() {
  return {
    status: 401 as const,
    body: { message: 'Request expired', expired: true },
  }
}

export const resetPasswordRoute = publicRoute({
  method: 'post',
  path: '/reset_password',
  schema: (z) => ({
    body: z.object({
      password: passwordSchema,
      token: z.string().min(1),
    }),
  }),
  handler: async (ctx) => {
    const { password, token } = ctx.state.validated.body
    const key = getResetTokenKey(token)

    const em = ctx.em
    const storedToken = await ctx.redis.get(key)
    if (!storedToken) {
      return expiredResponse()
    }

    const [userId, passwordFingerprint] = storedToken.split(':')
    const user = await em.repo(User).findOne(Number(userId))
    if (!user) {
      await ctx.redis.del(key)
      return expiredResponse()
    }

    // a password change after the link was sent invalidates it
    if (passwordFingerprint !== getHashFingerprint(user.password)) {
      return expiredResponse()
    }

    const isSamePassword = await bcrypt.compare(password, user.password)
    if (isSamePassword) {
      return {
        status: 400,
        body: { message: 'Please choose a different password' },
      }
    }

    user.password = await bcrypt.hash(password, 10)
    await ctx.redis.del(key)

    const sessions = await em.repo(UserSession).find({ user })
    await em.remove(sessions).flush()

    return { status: 204 }
  },
})
