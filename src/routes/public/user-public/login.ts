import { validator } from '../../../middleware/validator-middleware'
import { publicRoute } from '../../../lib/routing/router'
import User from '../../../entities/user'
import bcrypt from 'bcrypt'
import { buildTokenPair, updateLastSeenAt } from './common'

export const loginRoute = publicRoute({
  method: 'post',
  path: '/login',
  middleware: [
    validator('json', (z) => z.object({
      email: z.string().min(1),
      password: z.string().min(1)
    }))
  ],
  handler: async (c) => {
    const { email, password } = await c.req.json()
    const em = c.get('em')
    const redis = c.get('redis')

    const user = await em.getRepository(User).findOne({ email }, { populate: ['organisation.games'] })
    if (!user) {
      return c.json({ message: 'Incorrect email address or password' }, 401)
    }

    const passwordMatches = await bcrypt.compare(password, user.password)
    if (!passwordMatches) {
      return c.json({ message: 'Incorrect email address or password' }, 401)
    }

    if (user.twoFactorAuth?.enabled) {
      await redis.set(`2fa:${user.id}`, 'true', 'EX', 300)

      return c.json({
        twoFactorAuthRequired: true,
        userId: user.id
      })
    }

    const accessToken = await buildTokenPair(c, user)
    await updateLastSeenAt(c, user)

    return c.json({
      accessToken,
      user
    })
  }
})
