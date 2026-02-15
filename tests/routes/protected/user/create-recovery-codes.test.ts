import request from 'supertest'
import UserTwoFactorAuth from '../../../../src/entities/user-two-factor-auth'
import generateRecoveryCodes from '../../../../src/lib/auth/generateRecoveryCodes'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('User - create recovery codes', () => {
  it('should let users create a new set of recovery codes', async () => {
    const twoFactorAuth = new UserTwoFactorAuth('blah')
    twoFactorAuth.enabled = true
    const [token, user] = await createUserAndToken({ twoFactorAuth })

    user.recoveryCodes.set(generateRecoveryCodes(user))
    await em.flush()

    const res = await request(app)
      .post('/users/2fa/recovery_codes/create')
      .send({ password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.recoveryCodes).toHaveLength(8)

    await em.refresh(user, { populate: ['recoveryCodes'] })
    expect(user.recoveryCodes).toHaveLength(8)
  })

  it('should not create recovery codes if 2fa isn\'t enabled', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .post('/users/2fa/recovery_codes/create')
      .send({ password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Two factor authentication needs to be enabled' })
  })

  it('should not create recovery codes if the password is incorrect', async () => {
    const twoFactorAuth = new UserTwoFactorAuth('blah')
    twoFactorAuth.enabled = true
    const [token] = await createUserAndToken({ twoFactorAuth })

    const res = await request(app)
      .post('/users/2fa/recovery_codes/create')
      .send({ password: 'p@ssw0rd' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Incorrect password' })
  })
})
