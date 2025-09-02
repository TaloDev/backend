import { Collection, EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import UserRecoveryCode from '../../../../src/entities/user-recovery-code'
import createUserAndToken from '../../../utils/createUserAndToken'
import UserTwoFactorAuth from '../../../../src/entities/user-two-factor-auth'
import User from '../../../../src/entities/user'
import generateRecoveryCodes from '../../../../src/lib/auth/generateRecoveryCodes'

async function setTwoFactorAuthSession(user: User) {
  await redis.set(`2fa:${user.id}`, 'true')
}

async function removeTwoFactorAuthSession(user: User) {
  await redis.del(`2fa:${user.id}`)
}

async function createUserWithTwoFactorAuth(em: EntityManager): Promise<[string, User]> {
  const [token, user] = await createUserAndToken({
    twoFactorAuth: new UserTwoFactorAuth('blah')
  })

  user.twoFactorAuth!.enabled = true
  user.recoveryCodes = new Collection<UserRecoveryCode>(user, generateRecoveryCodes(user))
  await em.flush()

  return [token, user]
}

describe('User public service - use recovery code', () => {
  it('should let users login with a recovery code', async () => {
    const [token, user] = await createUserWithTwoFactorAuth(em)
    await setTwoFactorAuthSession(user)

    const res = await request(app)
      .post('/public/users/2fa/recover')
      .send({ code: user.recoveryCodes[0].getPlainCode(), userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.user.organisation).toBeTruthy()
    expect(res.body.user.organisation.games).toEqual([])

    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.newRecoveryCodes).toBeUndefined()

    await em.refresh(user, { populate: ['recoveryCodes'] })
    expect(user.recoveryCodes).toHaveLength(7)
  })

  it('should generate a new set of recovery codes after using the last one', async () => {
    const [token, user] = await createUserWithTwoFactorAuth(em)
    await setTwoFactorAuthSession(user)

    user.recoveryCodes.set([new UserRecoveryCode(user)])
    await em.flush()

    const res = await request(app)
      .post('/public/users/2fa/recover')
      .send({ code: user.recoveryCodes[0].getPlainCode(), userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.newRecoveryCodes).toHaveLength(8)

    await em.refresh(user, { populate: ['recoveryCodes'] })
    expect(user.recoveryCodes).toHaveLength(8)
  })

  it('should not let users login without a 2fa session', async () => {
    const [token, user] = await createUserWithTwoFactorAuth(em)
    await removeTwoFactorAuthSession(user) // key may exist for id since user ids are reused

    const res = await request(app)
      .post('/public/users/2fa/recover')
      .send({ code: 'abc123', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Session expired', sessionExpired: true })
  })

  it('should not let users login with an invalid recovery code', async () => {
    const [token, user] = await createUserWithTwoFactorAuth(em)
    await setTwoFactorAuthSession(user)

    const res = await request(app)
      .post('/public/users/2fa/recover')
      .send({ code: 'abc123', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Invalid code' })
  })
})
