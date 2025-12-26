import { publicRoute } from '../../../lib/routing/router'
import User from '../../../entities/user'
import UserSession from '../../../entities/user-session'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { verify } from '../../../lib/auth/jwt'

export const resetPasswordRoute = publicRoute({
  method: 'post',
  path: '/reset_password',
  schema: (z) => ({
    body: z.object({
      password: z.string().min(1),
      token: z.string().min(1)
    })
  }),
  handler: async (ctx) => {
    const { password, token } = ctx.request.body
    const decodedToken = jwt.decode(token)

    const em = ctx.em
    const user = await em.getRepository(User).findOne(Number(decodedToken?.sub))
    const secret = user?.password.substring(0, 10)

    try {
      await verify(token, secret!)
    } catch {
      ctx.status = 401
      ctx.body = { message: 'Request expired', expired: true }
      return
    }

    const isSamePassword = await bcrypt.compare(password, user!.password)
    if (isSamePassword) {
      ctx.status = 400
      ctx.body = { message: 'Please choose a different password' }
      return
    }

    user!.password = await bcrypt.hash(password, 10)

    const sessions = await em.repo(UserSession).find({ user })
    await em.removeAndFlush(sessions)

    ctx.status = 204
  }
})
