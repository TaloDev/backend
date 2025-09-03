import { wrap } from '@mikro-orm/mysql'
import request from 'supertest'
import UserTwoFactorAuth from '../../../src/entities/user-two-factor-auth'
import { authenticator } from '@otplib/preset-default'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'

describe('User service - confirm 2fa', () => {
  it('should let users confirm enabling 2fa', async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({
      twoFactorAuth: new UserTwoFactorAuth('blah')
    }, organisation)

    authenticator.check = vi.fn().mockReturnValueOnce(true)

    const res = await request(app)
      .post('/users/2fa/enable')
      .send({ code: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.user.organisation).toBeTruthy()
    expect(res.body.user.organisation.games).toHaveLength(1)

    expect(res.body.recoveryCodes).toHaveLength(8)

    await wrap(user.twoFactorAuth!).init()
    expect(user.twoFactorAuth!.enabled).toBe(true)
  })

  it('should not let users confirm enabling 2fa if it is already enabled', async () => {
    const [token, user] = await createUserAndToken({
      twoFactorAuth: new UserTwoFactorAuth('blah')
    })

    user.twoFactorAuth!.enabled = true
    await em.flush()

    const res = await request(app)
      .post('/users/2fa/enable')
      .send({ code: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Two factor authentication is already enabled' })
  })

  it('should not let users confirm enabling 2fa if the code is invalid', async () => {
    const [token] = await createUserAndToken({
      twoFactorAuth: new UserTwoFactorAuth('blah')
    })

    authenticator.check = vi.fn().mockReturnValueOnce(false)

    const res = await request(app)
      .post('/users/2fa/enable')
      .send({ code: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Invalid code' })
  })

  it('should not let users confirm enabling 2fa if it was not requested to be enabled', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .post('/users/2fa/enable')
      .send({ code: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Invalid code' })
  })
})
