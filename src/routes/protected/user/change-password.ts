import bcrypt from 'bcrypt'
import UserSession from '../../../entities/user-session'
import { buildTokenPair } from '../../../lib/auth/buildTokenPair'
import { protectedRoute } from '../../../lib/routing/router'
import { passwordSchema } from '../../../lib/validation/passwordSchema'

export const changePasswordRoute = protectedRoute({
  method: 'post',
  path: '/change_password',
  schema: (z) => ({
    body: z.object({
      currentPassword: passwordSchema,
      newPassword: passwordSchema,
    }),
  }),
  handler: async (ctx) => {
    const { currentPassword, newPassword } = ctx.state.validated.body
    const em = ctx.em
    const user = ctx.state.user

    const passwordMatches = await bcrypt.compare(currentPassword, user.password)
    if (!passwordMatches) {
      return {
        status: 403,
        body: { message: 'Current password is incorrect' },
      }
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password)
    if (isSamePassword) {
      return {
        status: 400,
        body: { message: 'Please choose a different password' },
      }
    }

    user.password = await bcrypt.hash(newPassword, 10)
    const sessions = await em.repo(UserSession).find({ user })
    await em.remove(sessions).flush()

    const accessToken = await buildTokenPair({
      em,
      ctx,
      user,
      userAgent: ctx.get('user-agent'),
    })

    return {
      status: 200,
      body: {
        accessToken,
      },
    }
  },
})
