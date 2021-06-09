import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import UserSession from '../../../../src/entities/user-session'
import UserFactory from '../../../fixtures/UserFactory'

const baseUrl = '/public/users'

describe('Users public service - refresh', () => {
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

  it('should let a user refresh their session if they have one', async () => {
    const user = await new UserFactory().one()
    user.lastSeenAt = new Date(2020, 1, 1)
    const session = new UserSession(user)
    await (<EntityManager>app.context.em).persistAndFlush(session)

    const res = await request(app.callback())
      .get(`${baseUrl}/refresh`)
      .set('Cookie', [`refreshToken=${session.token}`])
      .expect(200)

    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.user).toBeTruthy()
    expect(new Date(res.body.user.lastSeenAt).getDay()).toBe(new Date().getDay())
  })

  it('should not let a user refresh their session if they don\'t have one', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}/refresh`)
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Session not found' })
  })

  it('should not let a user refresh their session if it expired', async () => {
    const user = await new UserFactory().one()
    const session = new UserSession(user)
    session.validUntil = new Date(2020, 1, 1)
    await (<EntityManager>app.context.em).persistAndFlush(session)

    const res = await request(app.callback())
      .get(`${baseUrl}/refresh`)
      .set('Cookie', [`refreshToken=${session.token}`])
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Refresh token expired' })
  })
})
