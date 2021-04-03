import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import UserSession from '../../../src/entities/user-session'
import UserAccessCode from '../../../src/entities/user-access-code'
import UserFactory from '../../fixtures/UserFactory'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { promisify } from 'util'

const baseUrl = '/public/users'

describe('Users public service', () => {
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

  it('should register a user', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email: 'dev@trytalo.com', password: 'password', organisationName: 'Talo' })
      .expect(200)

    expect(res.body.accessToken).toBeDefined()
    expect(res.body.user).toBeDefined()
  })

  it('should not register a user without an organisation name', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email: 'dev@trytalo.com', password: 'password' })
      .expect(400)

      expect(res.body).toStrictEqual({ message: 'Missing body key: organisationName' })
  })

  it('should not let a user register if the email already exists', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email: 'dev@trytalo.com', password: 'password', organisationName: 'Talo' })
      .expect(400)

      expect(res.body).toStrictEqual({ message: 'That email address is already in use' })
  })

  it('should create an access code for a new user', async () => {
    await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email: 'bob@trytalo.com', password: 'password', organisationName: 'Talo' })
      .expect(200)

    const accessCode = await (<EntityManager>app.context.em).getRepository(UserAccessCode).findOne({
      user: {
        email: 'bob@trytalo.com'
      }
    })

    expect(accessCode).toBeTruthy()
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

  it('should let a user refresh their session if they have one', async () => {
    const user = await new UserFactory().one()
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
    const user = await new UserFactory().one()
    const session = new UserSession(user)
    session.validUntil = new Date(2020, 1, 1)
    await (<EntityManager>app.context.em).persistAndFlush(session)

    const res = await request(app.callback())
      .get(`${baseUrl}/refresh`)
      .set('Cookie', [`refreshToken=${session.token}`])
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Refresh token expired' })
  })

  it('should let a user request a forgot password email for an existing user', async () => {
    const user = await new UserFactory().with(() => ({ password: 'p4ssw0rd' })).one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    const res = await request(app.callback())
      .post(`${baseUrl}/forgot_password`)
      .send({ email: user.email })
      .expect(200)

    expect(res.body.user.id).toBe(user.id)
  })

  it('should let a user request a forgot password email for a non-existent user', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/forgot_password`)
      .send({ email: 'blah' })
      .expect(204)

    expect(res.body.user).not.toBeDefined()
  })

  it('should let a user change their password', async () => {
    const password = await bcrypt.hash('p4ssw0rd112233', 10)
    const user = await new UserFactory().with(() => ({ password })).one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    let res = await request(app.callback())
      .post(`${baseUrl}/forgot_password`)
      .send({ email: user.email })
      .expect(200)

    const token = res.body.accessToken

    res = await request(app.callback())
      .post(`${baseUrl}/change_password`)
      .send({ token, password: 'my-new-passw0rd1!' })
      .expect(200)

    expect(res.body.user.id).toBe(user.id)
    expect(res.body.accessToken).toBeDefined()
  })

  it('should not let a user change their password if they supply the same one', async () => {
    const password = await bcrypt.hash('p4ssw0rd112233', 10)
    const user = await new UserFactory().with(() => ({ password })).one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    let res = await request(app.callback())
      .post(`${baseUrl}/forgot_password`)
      .send({ email: user.email })
      .expect(200)

    const token = res.body.accessToken

    res = await request(app.callback())
      .post(`${baseUrl}/change_password`)
      .send({ token, password: 'p4ssw0rd112233' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Please choose a different password' })
  })

  it('should not let a user change their password if the token is invalid', async () => {
    const sign = promisify(jwt.sign)
    const token = await sign({ sub: 1 }, 'wrong secret', { expiresIn: '15m' })

    const res = await request(app.callback())
      .post(`${baseUrl}/change_password`)
      .send({ token, password: '3432ndjwedn1' })
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Request expired' })
  })
})
