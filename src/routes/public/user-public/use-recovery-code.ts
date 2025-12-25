import { validator } from '../../../middleware/validator-middleware'
import { RouteConfig } from '../../../lib/routing/router'
import { BaseContext } from '../../../lib/context'
import User from '../../../entities/user'
import UserRecoveryCode from '../../../entities/user-recovery-code'
import generateRecoveryCodes from '../../../lib/auth/generateRecoveryCodes'
import { buildTokenPair } from './common'

export const useRecoveryCodeRoute: RouteConfig<BaseContext> = {
  method: 'post',
  path: '/2fa/recover',
  middleware: [
    validator('json', (z) => z.object({
      userId: z.number(),
      code: z.string().min(1)
    }))
  ],
  handler: async (c) => {
    const { code, userId } = await c.req.json()
    const em = c.get('em')
    const redis = c.get('redis')

    const user = await em.getRepository(User).findOneOrFail(userId, {
      populate: ['recoveryCodes', 'organisation.games']
    })

    const hasSession = (await redis.get(`2fa:${user.id}`)) === 'true'

    if (!hasSession) {
      return c.json({ message: 'Session expired', sessionExpired: true }, 403)
    }

    const recoveryCode = user.recoveryCodes.getItems().find((recoveryCode) => {
      return recoveryCode.getPlainCode() === code
    })

    if (!recoveryCode) {
      return c.json({ message: 'Invalid code' }, 403)
    }

    em.remove(recoveryCode)

    let newRecoveryCodes: UserRecoveryCode[] = []
    if (user.recoveryCodes.count() === 0) {
      newRecoveryCodes = generateRecoveryCodes(user)
      user.recoveryCodes.set(newRecoveryCodes)
    }

    await em.flush()

    const accessToken = await buildTokenPair(c, user)
    await redis.del(`2fa:${user.id}`)

    return c.json({
      user,
      accessToken,
      newRecoveryCodes: newRecoveryCodes.length === 0 ? undefined : newRecoveryCodes
    })
  }
}
