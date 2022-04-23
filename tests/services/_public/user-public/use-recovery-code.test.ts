import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import User from '../../../../src/entities/user'
import { genAccessToken } from '../../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../../fixtures/UserFactory'
import Redis from 'ioredis'
import { RedisMock } from '../../../../__mocks__/ioredis'
import UserRecoveryCode from '../../../../src/entities/user-recovery-code'

const baseUrl = '/public/users'

describe('User public service - use recovery code', () => {
  let app: Koa
  let user: User
  let token: string
  const redis = new Redis()

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('loginable').state('has2fa').one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    token = await genAccessToken(user)
  })

  beforeEach(async () => {
    await (redis as Redis & RedisMock)._init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should let users login with a recovery code', async () => {
    await redis.set(`2fa:${user.id}`, 'true')

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/recover`)
      .send({ code: user.recoveryCodes[0], userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.newRecoveryCodes).toBeUndefined()

    const recoveryCodes = await (<EntityManager>app.context.em).getRepository(UserRecoveryCode).find({ user })
    expect(recoveryCodes).toHaveLength(7)
  })

  it('should generate a new set of recovery codes after using the last one', async () => {
    await redis.set(`2fa:${user.id}`, 'true')

    user.recoveryCodes.set([new UserRecoveryCode(user)])
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/recover`)
      .send({ code: user.recoveryCodes[0], userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.newRecoveryCodes).toHaveLength(8)

    const recoveryCodes = await (<EntityManager>app.context.em).getRepository(UserRecoveryCode).find({ user }, { refresh: true })
    expect(recoveryCodes).toHaveLength(8)
  })

  it('should not let users login without a 2fa session', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/recover`)
      .send({ code: 'abc123', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Session expired', sessionExpired: true })
  })

  it('should not let users login with an invalid recovery code', async () => {
    await redis.set(`2fa:${user.id}`, 'true')

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/recover`)
      .send({ code: 'abc123', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Invalid code' })
  })
})
