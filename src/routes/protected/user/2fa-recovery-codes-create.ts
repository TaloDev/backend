import generateRecoveryCodes from '../../../lib/auth/generateRecoveryCodes'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { passwordSchema } from '../../../lib/validation/passwordSchema'
import { confirmPassword, requires2fa } from './common'

export const createRecoveryCodesRoute = protectedRoute({
  method: 'post',
  path: '/2fa/recovery_codes/create',
  schema: (z) => ({
    body: z.object({
      password: passwordSchema,
    }),
  }),
  middleware: withMiddleware(confirmPassword, requires2fa),
  handler: async (ctx) => {
    const em = ctx.em

    const user = ctx.state.user
    await user.recoveryCodes.init()
    user.recoveryCodes.set(generateRecoveryCodes(user))

    await em.flush()

    return {
      status: 200,
      body: {
        recoveryCodes: user.recoveryCodes,
      },
    }
  },
})
