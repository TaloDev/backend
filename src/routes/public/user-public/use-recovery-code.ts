import { publicRoute } from '../../../lib/routing/router'
import User from '../../../entities/user'
import UserRecoveryCode from '../../../entities/user-recovery-code'
import generateRecoveryCodes from '../../../lib/auth/generateRecoveryCodes'
import { buildTokenPair } from './common'

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
    const { code, userId } = ctx.request.body
    const em = ctx.em
    const redis = ctx.redis

    const user = await em.getRepository(User).findOneOrFail(userId, {
      populate: ['recoveryCodes', 'organisation.games']
    })

    const hasSession = (await redis.get(`2fa:${user.id}`)) === 'true'

    if (!hasSession) {
      ctx.status = 403
      ctx.body = { message: 'Session expired', sessionExpired: true }
      return
    }

    const recoveryCode = user.recoveryCodes.getItems().find((recoveryCode) => {
      return recoveryCode.getPlainCode() === code
    })

    if (!recoveryCode) {
      ctx.status = 403
      ctx.body = { message: 'Invalid code' }
      return
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

    ctx.body = {
      user,
      accessToken,
      newRecoveryCodes: newRecoveryCodes.length === 0 ? undefined : newRecoveryCodes
    }
  }
})
