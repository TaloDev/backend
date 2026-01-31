import { protectedRoute } from '../../../lib/routing/router'
import { authenticator } from '@otplib/preset-default'
import UserTwoFactorAuth from '../../../entities/user-two-factor-auth'
import qrcode from 'qrcode'

export const enable2faRoute = protectedRoute({
  method: 'get',
  path: '/2fa/enable',
  handler: async (ctx) => {
    const em = ctx.em
    const user = ctx.state.user

    if (user.twoFactorAuth?.enabled) {
      return {
        status: 403,
        body: { message: 'Two factor authentication is already enabled' }
      }
    }

    const secret = authenticator.generateSecret()
    const keyUri = authenticator.keyuri(user.email, 'Talo', secret)
    const qr = await qrcode.toDataURL(keyUri)

    user.twoFactorAuth = new UserTwoFactorAuth(secret)
    await em.flush()

    return {
      status: 200,
      body: {
        qr
      }
    }
  }
})
