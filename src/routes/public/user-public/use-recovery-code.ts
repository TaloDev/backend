import { publicRoute } from '../../../lib/routing/router'
import User from '../../../entities/user'
import UserRecoveryCode from '../../../entities/user-recovery-code'
import generateRecoveryCodes from '../../../lib/auth/generateRecoveryCodes'
import { buildTokenPair } from '../../../lib/auth/buildTokenPair'

export const useRecoveryCodeRoute = publicRoute({
  method: 'post',
  path: '/2fa/recover',
  schema: (z) => ({
    body: z.object({
      userId: z.number(),
      code: z.string().min(1)
    })
  }),
  handler: async (ctx) => {
    const { code, userId } = ctx.state.validated.body
    const em = ctx.em
    const redis = ctx.redis

    const user = await em.repo(User).findOneOrFail(userId, {
      populate: ['recoveryCodes', 'organisation.games']
    })

    const hasSession = (await redis.get(`2fa:${user.id}`)) === 'true'

    if (!hasSession) {
      return {
        status: 403,
        body: { message: 'Session expired', sessionExpired: true }
      }
    }

    const recoveryCode = user.recoveryCodes.getItems().find((recoveryCode) => {
      return recoveryCode.getPlainCode() === code
    })

    if (!recoveryCode) {
      return {
        status: 403,
        body: { message: 'Invalid code' }
      }
    }

    em.remove(recoveryCode)

    let newRecoveryCodes: UserRecoveryCode[] = []
    if (user.recoveryCodes.count() === 0) {
      newRecoveryCodes = generateRecoveryCodes(user)
      user.recoveryCodes.set(newRecoveryCodes)
    }

    await em.flush()

    const accessToken = await buildTokenPair({ em, ctx, user, userAgent: ctx.get('user-agent') })
    await redis.del(`2fa:${user.id}`)

    return {
      status: 200,
      body: {
        user,
        accessToken,
        newRecoveryCodes: newRecoveryCodes.length === 0 ? undefined : newRecoveryCodes
      }
    }
  }
})
