import { publicRoute } from '../../../lib/routing/router'
import User from '../../../entities/user'
import UserSession from '../../../entities/user-session'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { verify } from '../../../lib/auth/jwt'
import assert from 'node:assert'

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
    const { password, token } = ctx.state.validated.body
    const decodedToken = jwt.decode(token)

    const em = ctx.em
    const user = await em.repo(User).findOne(Number(decodedToken?.sub))

    try {
      const secret = user?.password.substring(0, 10) ?? 'no-timing-attacks'
      await verify(token, secret)
    } catch {
      return {
        status: 401,
        body: { message: 'Request expired', expired: true }
      }
    }

    // verify() would've failed if the user is not defined
    assert(user)

    const isSamePassword = await bcrypt.compare(password, user.password)
    if (isSamePassword) {
      return {
        status: 400,
        body: { message: 'Please choose a different password' }
      }
    }

    user.password = await bcrypt.hash(password, 10)

    const sessions = await em.repo(UserSession).find({ user })
    await em.remove(sessions).flush()

    return { status: 204 }
  }
})
