import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import UserSession from '../../../../src/entities/user-session'
import UserFactory from '../../../fixtures/UserFactory'

const baseUrl = '/public/users'

describe('Users public service - login', () => {
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
      .send({ email: 'dev@trytalo.com', password: 'password' })
      .expect(200)

    expect(res.body.accessToken).toBeDefined()
    expect(res.body.user).toBeDefined()
    expect(res.body.user.organisation).toBeDefined()
    expect(new Date(res.body.user.lastSeenAt).getDay()).toBe(new Date().getDay())
  })

  it('should not let a user login with the wrong password', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/login`)
      .send({ email: 'dev@trytalo.com', password: 'asdasdadasd' })
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
})
