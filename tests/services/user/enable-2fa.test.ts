import request from 'supertest'
import UserTwoFactorAuth from '../../../src/entities/user-two-factor-auth'
import createUserAndToken from '../../utils/createUserAndToken'

describe('User service - enable 2fa', () => {
  it('should let users enable 2fa', async () => {
    const [token, user] = await createUserAndToken()

    const res = await request(app)
      .get('/users/2fa/enable')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.qr).toBeTruthy()

    await em.refresh(user)
    expect(user.twoFactorAuth).toBeTruthy()
    expect(user.twoFactorAuth!.enabled).toBe(false)
  })

  it('should not let users enable 2fa if it is already enabled', async () => {
    const [token, user] = await createUserAndToken({
      twoFactorAuth: new UserTwoFactorAuth('blah')
    })

    user.twoFactorAuth!.enabled = true
    await em.flush()

    const res = await request(app)
      .get('/users/2fa/enable')
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Two factor authentication is already enabled' })
  })
})
