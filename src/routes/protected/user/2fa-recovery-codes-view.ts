import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { passwordSchema } from '../../../lib/validation/passwordSchema.js'
import { confirmPassword, requires2fa } from './common.js'

export const viewRecoveryCodesRoute = protectedRoute({
  method: 'post',
  path: '/2fa/recovery_codes/view',
  schema: (z) => ({
    body: z.object({
      password: passwordSchema,
    }),
  }),
  middleware: withMiddleware(confirmPassword, requires2fa),
  handler: async (ctx) => {
    const user = ctx.state.user
    const recoveryCodes = await user.recoveryCodes.loadItems()

    return {
      status: 200,
      body: {
        recoveryCodes,
      },
    }
  },
})
