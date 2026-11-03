import { getGlobalQueue } from '../../../config/global-queues.js'
import ResetPassword from '../../../emails/reset-password.js'
import User from '../../../entities/user.js'
import {
  generateResetToken,
  getHashFingerprint,
  getResetTokenKey,
  RESET_TOKEN_TTL_SECONDS,
} from '../../../lib/auth/resetToken.js'
import queueEmail from '../../../lib/messaging/queueEmail.js'
import { publicRoute } from '../../../lib/routing/router.js'

export const forgotPasswordRoute = publicRoute({
  method: 'post',
  path: '/forgot_password',
  schema: (z) => ({
    body: z.object({
      email: z.string().min(1),
    }),
  }),
  handler: async (ctx) => {
    const { email } = ctx.state.validated.body
    const em = ctx.em

    const user = await em.repo(User).findOne({ email })

    if (user) {
      const token = generateResetToken()
      const value = `${user.id}:${getHashFingerprint(user.password)}`
      await ctx.redis.set(getResetTokenKey(token), value, 'EX', RESET_TOKEN_TTL_SECONDS)
      await queueEmail(getGlobalQueue('email'), new ResetPassword(user, token))
    }

    return {
      status: 204,
    }
  },
})
