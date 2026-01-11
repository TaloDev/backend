import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { passwordSchema } from '../../../lib/validation/passwordSchema'
import { confirmPassword, requires2fa } from './common'

export const disable2faRoute = protectedRoute({
  method: 'post',
  path: '/2fa/disable',
  schema: (z) => ({
    body: z.object({
      password: passwordSchema
    })
  }),
  middleware: withMiddleware(confirmPassword, requires2fa),
  handler: async (ctx) => {
    const em = ctx.em
    const user = ctx.state.authenticatedUser

    const recoveryCodes = await user.recoveryCodes.loadItems()
    await em.remove([user.twoFactorAuth, ...recoveryCodes]).flush()

    return {
      status: 200,
      body: {
        user
      }
    }
  }
})
