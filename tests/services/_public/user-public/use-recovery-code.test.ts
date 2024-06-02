import { Collection, EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import UserRecoveryCode from '../../../../src/entities/user-recovery-code.js'
import redisConfig from '../../../../src/config/redis.config.js'
import { Redis } from 'ioredis'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import UserTwoFactorAuth from '../../../../src/entities/user-two-factor-auth.js'
import User from '../../../../src/entities/user.js'
import generateRecoveryCodes from '../../../../src/lib/auth/generateRecoveryCodes.js'

async function setTwoFactorAuthSession(user: User) {
  const redis = new Redis(redisConfig)
  await redis.set(`2fa:${user.id}`, 'true')
  await redis.quit()
}

async function removeTwoFactorAuthSession(user: User) {
  const redis = new Redis(redisConfig)
  await redis.del(`2fa:${user.id}`)
  await redis.quit()
}

async function createUserWithTwoFactorAuth(em: EntityManager): Promise<[string, User]> {
  const [token, user] = await createUserAndToken({
    twoFactorAuth: new UserTwoFactorAuth('blah')
  })

  user.twoFactorAuth.enabled = true
  user.recoveryCodes = new Collection<UserRecoveryCode>(user, generateRecoveryCodes(user))
  await em.flush()

  return [token, user]
}

describe('User public service - use recovery code', () => {
  it('should let users login with a recovery code', async () => {
    const [token, user] = await createUserWithTwoFactorAuth(global.em)
    await setTwoFactorAuthSession(user)

    const res = await request(global.app)
      .post('/public/users/2fa/recover')
      .send({ code: user.recoveryCodes[0].getPlainCode(), userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.newRecoveryCodes).toBeUndefined()

    await (<EntityManager>global.em).refresh(user, { populate: ['recoveryCodes'] })
    expect(user.recoveryCodes).toHaveLength(7)
  })

  it('should generate a new set of recovery codes after using the last one', async () => {
    const [token, user] = await createUserWithTwoFactorAuth(global.em)
    await setTwoFactorAuthSession(user)

    user.recoveryCodes.set([new UserRecoveryCode(user)])
    await (<EntityManager>global.em).flush()

    const res = await request(global.app)
      .post('/public/users/2fa/recover')
      .send({ code: user.recoveryCodes[0].getPlainCode(), userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.newRecoveryCodes).toHaveLength(8)

    await (<EntityManager>global.em).refresh(user, { populate: ['recoveryCodes'] })
    expect(user.recoveryCodes).toHaveLength(8)
  })

  it('should not let users login without a 2fa session', async () => {
    const [token, user] = await createUserWithTwoFactorAuth(global.em)
    await removeTwoFactorAuthSession(user) // key may exist for id since user ids are reused

    const res = await request(global.app)
      .post('/public/users/2fa/recover')
      .send({ code: 'abc123', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Session expired', sessionExpired: true })
  })

  it('should not let users login with an invalid recovery code', async () => {
    const [token, user] = await createUserWithTwoFactorAuth(global.em)
    await setTwoFactorAuthSession(user)

    const res = await request(global.app)
      .post('/public/users/2fa/recover')
      .send({ code: 'abc123', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Invalid code' })
  })
})
