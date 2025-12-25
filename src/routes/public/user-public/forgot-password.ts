import { validator } from '../../../middleware/validator-middleware'
import { RouteConfig } from '../../../lib/routing/router'
import { BaseContext } from '../../../lib/context'
import User from '../../../entities/user'
import { sign } from '../../../lib/auth/jwt'
import queueEmail from '../../../lib/messaging/queueEmail'
import ResetPassword from '../../../emails/reset-password'
import { getGlobalQueue } from '../../../config/global-queues'

export const forgotPasswordRoute: RouteConfig<BaseContext> = {
  method: 'post',
  path: '/forgot_password',
  middleware: [
    validator('json', (z) => z.object({
      email: z.string().min(1)
    }))
  ],
  handler: async (c) => {
    const { email } = await c.req.json()
    const em = c.get('em')

    const user = await em.getRepository(User).findOne({ email })

    if (user) {
      const secret = user.password.substring(0, 10)
      const payload = { sub: user.id }
      const accessToken = await sign(payload, secret, { expiresIn: '15m' })
      await queueEmail(getGlobalQueue('email'), new ResetPassword(user, accessToken))
    }

    return c.body(null, 204)
  }
}
