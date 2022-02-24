import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import UserTwoFactorAuth from '../../../src/entities/user-two-factor-auth'
import generateRecoveryCodes from '../../../src/lib/auth/generateRecoveryCodes'
import UserRecoveryCode from '../../../src/entities/user-recovery-code'

const baseUrl = '/users'

describe('User service - create recovery codes', () => {
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

  it('should let users create a new set of recovery codes', async () => {
    user.recoveryCodes.set(generateRecoveryCodes(user))
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/recovery_codes/create`)
      .send({ password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.recoveryCodes).toHaveLength(8)

    const recoveryCodes = await (<EntityManager>app.context.em).getRepository(UserRecoveryCode  ).find({ user }, { refresh: true })
    expect(recoveryCodes).toHaveLength(8)
  })

  it('should not create recovery codes if 2fa isn\'t enabled', async () => {
    user.twoFactorAuth = null
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/recovery_codes/create`)
      .send({ password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Two factor authentication needs to be enabled' })
  })

  it('should not create recovery codes if the password is incorrect', async () => {
    user.twoFactorAuth = new UserTwoFactorAuth('blah')
    user.twoFactorAuth.enabled = true
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/recovery_codes/create`)
      .send({ password: 'p@ssw0rd' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Incorrect password' })
  })
})
