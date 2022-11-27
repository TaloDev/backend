import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import User from '../../../../src/entities/user'
import { genAccessToken } from '../../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../../fixtures/UserFactory'
import { authenticator } from '@otplib/preset-default'
import Redis from 'ioredis'
import redisConfig from '../../../../src/config/redis.config'

const baseUrl = '/public/users'

describe('User public service - verify 2fa', () => {
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

  it('should let users verify their 2fa code and login', async () => {
    const redis = new Redis(redisConfig)
    await redis.set(`2fa:${user.id}`, 'true')

    authenticator.check = jest.fn().mockReturnValueOnce(true)

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa`)
      .send({ code: '123456', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.accessToken).toBeTruthy()

    const hasSession = await redis.get(`2fa:${user.id}`)
    expect(hasSession).toBeNull()

    await redis.quit()
  })

  it('should not let users verify their 2fa without a session', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/2fa`)
      .send({ code: '123456', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Session expired', sessionExpired: true })
  })

  it('should not let users verify their 2fa with an invalid code', async () => {
    const redis = new Redis(redisConfig)
    await redis.set(`2fa:${user.id}`, 'true')

    authenticator.check = jest.fn().mockReturnValueOnce(false)

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa`)
      .send({ code: '123456', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Invalid code' })

    await redis.quit()
  })
})
