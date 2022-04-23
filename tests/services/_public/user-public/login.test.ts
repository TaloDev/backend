import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import UserSession from '../../../../src/entities/user-session'
import UserFactory from '../../../fixtures/UserFactory'
import { differenceInMinutes, sub } from 'date-fns'
import Redis from 'ioredis'
import { RedisMock } from '../../../../__mocks__/ioredis'

const baseUrl = '/public/users'

describe('User public service - login', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  beforeEach(async () => {
    const repo = (<EntityManager>app.context.em).getRepository(UserSession)
    const sessions = await repo.findAll()
    await repo.removeAndFlush(sessions)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should let a user login', async () => {
    const user = await new UserFactory().state('loginable').one()
    user.lastSeenAt = new Date(2020, 1, 1)
    await (<EntityManager>app.context.em).persistAndFlush(user)

    const res = await request(app.callback())
      .post(`${baseUrl}/login`)
      .send({ email: user.email, password: 'password' })
      .expect(200)

    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.user).toBeTruthy()
    expect(res.body.user.organisation).toBeTruthy()
    expect(new Date(res.body.user.lastSeenAt).getDay()).toBe(new Date().getDay())
  })

  it('should not let a user login with the wrong password', async () => {
    const user = await new UserFactory().one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    const res = await request(app.callback())
      .post(`${baseUrl}/login`)
      .send({ email: user.email, password: 'asdasdadasd' })
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Incorrect email address or password', showHint: true })
  })

  it('should not let a user login with the wrong email', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/login`)
      .send({ email: 'dev@trytal0.com', password: 'password' })
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Incorrect email address or password', showHint: true })
  })

  it('should not update the last seen at if the user was last seen today', async () => {
    const lastSeenAt = sub(new Date(), { hours: 1 })

    const user = await new UserFactory().state('loginable').with(() => ({ lastSeenAt })).one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    const res = await request(app.callback())
      .post(`${baseUrl}/login`)
      .send({ email: user.email, password: 'password' })
      .expect(200)

    expect(Math.abs(differenceInMinutes(new Date(res.body.user.lastSeenAt), lastSeenAt))).toBe(0)
  })

  it('should initialise the 2fa flow if it is enabled', async () => {
    const redis = new Redis()
    await (redis as Redis & RedisMock)._init()

    const user = await new UserFactory().state('loginable').state('has2fa').one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    const res = await request(app.callback())
      .post(`${baseUrl}/login`)
      .send({ email: user.email, password: 'password' })
      .expect(200)

    expect(res.body).toStrictEqual({
      twoFactorAuthRequired: true,
      userId: user.id
    })

    const hasSession = await redis.get(`2fa:${user.id}`)
    expect(hasSession).toBe('true')
  })
})
