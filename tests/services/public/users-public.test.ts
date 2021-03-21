import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import UserSession from '../../../src/entities/user-session'
import UserAccessCode from '../../../src/entities/user-access-code'

const baseUrl = '/public/users'

describe('Users public service', () => {
  let app: Koa
  let user: User

  beforeAll(async () => {
    app = await init()

    user = new User()
    await (<EntityManager>app.context.em).persistAndFlush(user)
  })

  beforeEach(async () => {
    const repo = (<EntityManager>app.context.em).getRepository(UserSession)
    const sessions = await repo.findAll()
    await repo.removeAndFlush(sessions)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should register a user', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email: 'dev@trytalo.com', password: 'password' })
      .expect(200)

    expect(res.body.accessToken).toBeDefined()
    expect(res.body.user).toBeDefined()
  })

  it('should not let a user register if the email already exists', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email: 'dev@trytalo.com', password: 'password' })
      .expect(400)

      expect(res.body).toStrictEqual({ message: 'That email address is already in use' })
  })

  it('should create an access code for a new user', async () => {
    await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email: 'bob@trytalo.com', password: 'password' })
      .expect(200)

    const accessCode = await (<EntityManager>app.context.em).getRepository(UserAccessCode).findOne({
      user: {
        email: 'bob@trytalo.com'
      }
    })

    expect(accessCode).toBeTruthy()
  })

  it('should let a user login', async () => {
    user.lastSeenAt = new Date(2020, 1, 1)
    await (<EntityManager>app.context.em).persistAndFlush(user)

    const res = await request(app.callback())
      .post(`${baseUrl}/login`)
      .send({ email: 'dev@trytalo.com', password: 'password' })
      .expect(200)

    expect(res.body.accessToken).toBeDefined()
    expect(res.body.user).toBeDefined()
    expect(res.body.user.games).toBeDefined()
    expect(new Date(res.body.user.lastSeenAt).getDay()).toBe(new Date().getDay())
  })

  it('should not let a user login with the wrong password', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/login`)
      .send({ email: 'dev@trytalo.com', password: 'asdasdadasd' })
      .expect(401)

      expect(res.body).toStrictEqual({ message: 'Incorrect email address or password', showHint: true })
  })

  it('should let a user refresh their session if they have one', async () => {
    user.lastSeenAt = new Date(2020, 1, 1)
    const session = new UserSession(user)
    await (<EntityManager>app.context.em).persistAndFlush(session)

    const res = await request(app.callback())
      .get(`${baseUrl}/refresh`)
      .set('Cookie', [`refreshToken=${session.token}`])
      .expect(200)

    expect(res.body.accessToken).toBeDefined()
    expect(res.body.user).toBeDefined()
    expect(new Date(res.body.user.lastSeenAt).getDay()).toBe(new Date().getDay())
  })

  it('should not let a user refresh their session if they don\'t have one', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}/refresh`)
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Session not found' })
  })

  it('should not let a user refresh their session if it expired', async () => {
    const session = new UserSession(user)
    session.validUntil = new Date(2020, 1, 1)
    await (<EntityManager>app.context.em).persistAndFlush(session)

    const res = await request(app.callback())
      .get(`${baseUrl}/refresh`)
      .set('Cookie', [`refreshToken=${session.token}`])
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Refresh token expired' })
  })
})
