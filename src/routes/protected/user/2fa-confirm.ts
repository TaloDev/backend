import { authenticator } from '@otplib/preset-default'
import { randomBytes } from 'crypto'
import assert from 'node:assert'
import generateRecoveryCodes from '../../../lib/auth/generateRecoveryCodes'
import { protectedRoute } from '../../../lib/routing/router'

export const confirm2faRoute = protectedRoute({
  method: 'post',
  path: '/2fa/enable',
  schema: (z) => ({
    body: z.object({
      code: z.string(),
    }),
  }),
  handler: async (ctx) => {
    const { code } = ctx.state.validated.body
    const em = ctx.em
    const user = ctx.state.user
    const twoFactorAuth = user.twoFactorAuth

    if (twoFactorAuth?.enabled) {
      return {
        status: 403,
        body: { message: 'Two factor authentication is already enabled' },
      }
    }

    const secret = twoFactorAuth?.secret ?? randomBytes(16).toString('hex') // random secret so it always fails
    if (!authenticator.check(code, secret)) {
      return {
        status: 403,
        body: { message: 'Invalid code' },
      }
    }

    user.recoveryCodes.set(generateRecoveryCodes(user))

    assert(twoFactorAuth)
    twoFactorAuth.enabled = true
    await em.flush()

    return {
      status: 200,
      body: {
        user,
        recoveryCodes: user.recoveryCodes,
      },
    }
  },
})
