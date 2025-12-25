import { validator } from '../../../middleware/validator-middleware'
import { RouteConfig } from '../../../lib/routing/router'
import { BaseContext } from '../../../lib/context'
import User from '../../../entities/user'
import UserSession from '../../../entities/user-session'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { verify } from '../../../lib/auth/jwt'

export const resetPasswordRoute: RouteConfig<BaseContext> = {
  method: 'post',
  path: '/reset_password',
  middleware: [
    validator('json', (z) => z.object({
      password: z.string().min(1),
      token: z.string().min(1)
    }))
  ],
  handler: async (c) => {
    const { password, token } = await c.req.json()
    const decodedToken = jwt.decode(token)

    const em = c.get('em')
    const user = await em.getRepository(User).findOne(Number(decodedToken?.sub))
    const secret = user?.password.substring(0, 10)

    try {
      await verify(token, secret!)
    } catch {
      return c.json({ message: 'Request expired', expired: true }, 401)
    }

    const isSamePassword = await bcrypt.compare(password, user!.password)
    if (isSamePassword) {
      return c.json({ message: 'Please choose a different password' }, 400)
    }

    user!.password = await bcrypt.hash(password, 10)

    const sessions = await em.repo(UserSession).find({ user })
    await em.removeAndFlush(sessions)

    return c.body(null, 204)
  }
}
