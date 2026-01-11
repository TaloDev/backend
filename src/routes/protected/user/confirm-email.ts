import { protectedRoute } from '../../../lib/routing/router'
import UserAccessCode from '../../../entities/user-access-code'

export const confirmEmailRoute = protectedRoute({
  method: 'post',
  path: '/confirm_email',
  schema: (z) => ({
    body: z.object({
      code: z.string()
    })
  }),
  handler: async (ctx) => {
    const { code } = ctx.state.validated.body
    const em = ctx.em
    const user = ctx.state.authenticatedUser

    let accessCode: UserAccessCode
    try {
      accessCode = await em.repo(UserAccessCode).findOneOrFail({
        user,
        code,
        validUntil: {
          $gt: new Date()
        }
      })
    } catch {
      return {
        status: 400,
        body: { message: 'Invalid or expired code' }
      }
    }

    user.emailConfirmed = true
    await em.remove(accessCode).flush()

    return {
      status: 200,
      body: {
        user
      }
    }
  }
})
