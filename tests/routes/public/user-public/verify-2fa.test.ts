import request from 'supertest'
import { authenticator } from '@otplib/preset-default'
import UserTwoFactorAuth from '../../../../src/entities/user-two-factor-auth'
import createUserAndToken from '../../../utils/createUserAndToken'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'

describe('User public  - verify 2fa', () => {
  it('should let users verify their 2fa code and login', async () => {
    const twoFactorAuth = new UserTwoFactorAuth('blah')
    twoFactorAuth.enabled = true

    const [organisation] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ twoFactorAuth }, organisation)

    await redis.set(`2fa:${user.id}`, 'true')

    authenticator.check = vi.fn().mockReturnValueOnce(true)

    const res = await request(app)
      .post('/public/users/2fa')
      .send({ code: '123456', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.user.organisation).toBeTruthy()
    expect(res.body.user.organisation.games).toHaveLength(1)

    expect(res.body.accessToken).toBeTruthy()

    const hasSession = await redis.get(`2fa:${user.id}`)
    expect(hasSession).toBeNull()
  })

  it('should not let users verify their 2fa without a session', async () => {
    const twoFactorAuth = new UserTwoFactorAuth('blah')
    twoFactorAuth.enabled = true
    const [token, user] = await createUserAndToken({ twoFactorAuth })

    const res = await request(app)
      .post('/public/users/2fa')
      .send({ code: '123456', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Session expired', sessionExpired: true })
  })

  it('should not let users verify their 2fa with an invalid code', async () => {
    const twoFactorAuth = new UserTwoFactorAuth('blah')
    twoFactorAuth.enabled = true
    const [token, user] = await createUserAndToken({ twoFactorAuth })

    await redis.set(`2fa:${user.id}`, 'true')

    authenticator.check = vi.fn().mockReturnValueOnce(false)

    const res = await request(app)
      .post('/public/users/2fa')
      .send({ code: '123456', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Invalid code' })
  })
})
