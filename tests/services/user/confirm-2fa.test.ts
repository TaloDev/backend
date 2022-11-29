import { EntityManager, wrap } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import UserTwoFactorAuth from '../../../src/entities/user-two-factor-auth'
import { authenticator } from '@otplib/preset-default'
import createUserAndToken from '../../utils/createUserAndToken'

const baseUrl = '/users'

describe('User service - confirm 2fa', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should let users confirm enabling 2fa', async () => {
    const [token, user] = await createUserAndToken(app.context.em, {
      twoFactorAuth: new UserTwoFactorAuth('blah')
    })

    authenticator.check = jest.fn().mockReturnValueOnce(true)

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/enable`)
      .send({ code: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.recoveryCodes).toHaveLength(8)

    await wrap(user.twoFactorAuth).init()
    expect(user.twoFactorAuth.enabled).toBe(true)
  })

  it('should not let users confirm enabling 2fa if it is already enabled', async () => {
    const [token, user] = await createUserAndToken(app.context.em, {
      twoFactorAuth: new UserTwoFactorAuth('blah')
    })

    user.twoFactorAuth.enabled = true
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/enable`)
      .send({ code: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Two factor authentication is already enabled' })
  })

  it('should not let users confirm enabling 2fa if the code is invalid', async () => {
    const [token] = await createUserAndToken(app.context.em, {
      twoFactorAuth: new UserTwoFactorAuth('blah')
    })

    authenticator.check = jest.fn().mockReturnValueOnce(false)

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/enable`)
      .send({ code: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Invalid code' })
  })

  it('should not let users confirm enabling 2fa if it was not requested to be enabled', async () => {
    const [token] = await createUserAndToken(app.context.em)

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/enable`)
      .send({ code: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Invalid code' })
  })
})
