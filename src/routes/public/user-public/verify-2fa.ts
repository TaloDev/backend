import { validator } from '../../../middleware/validator-middleware'
import { RouteConfig } from '../../../lib/routing/router'
import { BaseContext } from '../../../lib/context'
import User from '../../../entities/user'
import { authenticator } from '@otplib/preset-default'
import { buildTokenPair, updateLastSeenAt } from './common'

export const verify2faRoute: RouteConfig<BaseContext> = {
  method: 'post',
  path: '/2fa',
  middleware: [
    validator('json', (z) => z.object({
      code: z.string().min(1),
      userId: z.number()
    }))
  ],
  handler: async (c) => {
    const { code, userId } = await c.req.json()
    const em = c.get('em')
    const redis = c.get('redis')

    const user = await em.repo(User).findOneOrFail(userId, { populate: ['organisation.games'] })

    const hasSession = (await redis.get(`2fa:${user.id}`)) === 'true'

    if (!hasSession) {
      return c.json({ message: 'Session expired', sessionExpired: true }, 403)
    }

    if (!authenticator.check(code, user.twoFactorAuth!.secret)) {
      return c.json({ message: 'Invalid code' }, 403)
    }

    const accessToken = await buildTokenPair(c, user)
    await redis.del(`2fa:${user.id}`)
    await updateLastSeenAt(c, user)

    return c.json({
      accessToken,
      user
    })
  }
}
