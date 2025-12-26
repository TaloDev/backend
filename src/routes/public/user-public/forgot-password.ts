import { publicRoute } from '../../../lib/routing/router'
import User from '../../../entities/user'
import { sign } from '../../../lib/auth/jwt'
import queueEmail from '../../../lib/messaging/queueEmail'
import ResetPassword from '../../../emails/reset-password'
import { getGlobalQueue } from '../../../config/global-queues'

export const forgotPasswordRoute = publicRoute({
  method: 'post',
  path: '/forgot_password',
  schema: (z) => ({
    body: z.object({
      email: z.string().min(1)
    })
  }),
  handler: async (ctx) => {
    const { email } = ctx.request.body
    const em = ctx.em

    const user = await em.getRepository(User).findOne({ email })

    if (user) {
      const secret = user.password.substring(0, 10)
      const payload = { sub: user.id }
      const accessToken = await sign(payload, secret, { expiresIn: '15m' })
      await queueEmail(getGlobalQueue('email'), new ResetPassword(user, accessToken))
    }

    ctx.status = 204
  }
})
