import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import UserTwoFactorAuth from '../../../src/entities/user-two-factor-auth'
import UserRecoveryCode from '../../../src/entities/user-recovery-code'

const baseUrl = '/users'

describe('User service - disable 2fa', () => {
  let app: Koa
  let user: User
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('loginable').state('has2fa').one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should let users disable 2fa', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/disable`)
      .send({ password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user.has2fa).toBe(false)

    const recoveryCodes = await (<EntityManager>app.context.em).getRepository(UserRecoveryCode).find({ user })
    expect(recoveryCodes).toHaveLength(0)

    const user2fa = await (<EntityManager>app.context.em).getRepository(UserTwoFactorAuth).findOne({ user })
    expect(user2fa).toBeNull()
  })

  it('should not try to disable 2fa if it isn\'t enabled', async () => {
    user.twoFactorAuth = null
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/disable`)
      .send({ password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Two factor authentication needs to be enabled' })
  })

  it('should not try to disable 2fa if the password is incorrect', async () => {
    user.twoFactorAuth = new UserTwoFactorAuth('blah')
    user.twoFactorAuth.enabled = true
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/disable`)
      .send({ password: 'p@ssw0rd' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Incorrect password' })
  })
})
