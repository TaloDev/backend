import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import UserTwoFactorAuth from '../../../src/entities/user-two-factor-auth'

const baseUrl = '/users'

describe('Users service - enable 2fa', () => {
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

  it('should let users enable 2fa', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}/2fa/enable`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.qr).toBeTruthy()

    const userTwoFactorAuth = await (<EntityManager>app.context.em).getRepository(UserTwoFactorAuth).findOne({ user })
    expect(userTwoFactorAuth).toBeDefined()
    expect(userTwoFactorAuth.enabled).toBe(false)
  })

  it('should not let users enable 2fa if it is already enabled', async () => {
    user.twoFactorAuth = new UserTwoFactorAuth('blah')
    user.twoFactorAuth.enabled = true
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .get(`${baseUrl}/2fa/enable`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Two factor authentication is already enabled' })
  })
})
