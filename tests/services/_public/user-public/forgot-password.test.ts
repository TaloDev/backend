import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import UserSession from '../../../../src/entities/user-session'
import UserFactory from '../../../fixtures/UserFactory'

const baseUrl = '/public/users'

describe('User public service - forgot password', () => {
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

    expect(res.body.user).not.toBeTruthy()
  })
})
