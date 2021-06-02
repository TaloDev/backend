import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import UserSession from '../../../../src/entities/user-session'
import UserAccessCode from '../../../../src/entities/user-access-code'
import casual from 'casual'
import UserFactory from '../../../fixtures/UserFactory'

const baseUrl = '/public/users'

describe('Users public service - register', () => {
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
      .send({ email: casual.email, password: 'password', organisationName: 'Talo' })
      .expect(200)

    expect(res.body.accessToken).toBeDefined()
    expect(res.body.user).toBeDefined()
  })

  it('should not register a user without an organisation name', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email: casual.email, password: 'password' })
      .expect(400)

      expect(res.body).toStrictEqual({ message: 'Missing body key: organisationName' })
  })

  it('should not let a user register if the email already exists', async () => {
    const email = casual.email
    const user = await new UserFactory().with(() => ({ email })).one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    const res = await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email, password: 'password', organisationName: 'Talo' })
      .expect(400)

      expect(res.body).toStrictEqual({ message: 'That email address is already in use' })
  })

  it('should create an access code for a new user', async () => {
    const email = casual.email

    await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email, password: 'password', organisationName: 'Talo' })
      .expect(200)

    const accessCode = await (<EntityManager>app.context.em).getRepository(UserAccessCode).findOne({
      user: {
        email
      }
    })

    expect(accessCode).toBeTruthy()
  })
})
