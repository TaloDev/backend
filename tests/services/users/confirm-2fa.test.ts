import { EntityManager, wrap } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import UserTwoFactorAuth from '../../../src/entities/user-two-factor-auth'
import { authenticator } from '@otplib/preset-default'

const baseUrl = '/users'

describe('Users service - confirm 2fa', () => {
  let app: Koa
  let user: User
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should let users confirm enabling 2fa', async () => {
    user.twoFactorAuth = new UserTwoFactorAuth('blah')
    await (<EntityManager>app.context.em).flush()

    authenticator.check = jest.fn().mockReturnValueOnce(true)

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/enable`)
      .send({ token: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.recoveryCodes).toHaveLength(8)

    await wrap(user.twoFactorAuth).init()
    expect(user.twoFactorAuth.enabled).toBe(true)
  })

  it('should not let users confirm enabling 2fa if it is already enabled', async () => {
    user.twoFactorAuth = new UserTwoFactorAuth('blah')
    user.twoFactorAuth.enabled = true
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/enable`)
      .send({ token: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Two factor authentication is already enabled' })
  })

  it('should not let users confirm enabling 2fa if the code is invalid', async () => {
    user.twoFactorAuth = new UserTwoFactorAuth('blah')
    await (<EntityManager>app.context.em).flush()

    authenticator.check = jest.fn().mockReturnValueOnce(false)

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/enable`)
      .send({ token: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Invalid token' })
  })

  it('should not let users confirm enabling 2fa if it was not requested to be enabled', async () => {
    user.twoFactorAuth = null
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/enable`)
      .send({ token: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Invalid token' })
  })
})
