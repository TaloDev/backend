import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import UserSession from '../../../src/entities/user-session'

const baseUrl = '/users'

describe('User service - logout', () => {
  let app: Koa
  let user: User
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should be able to log a user out and clear sessions', async () => {
    const session = new UserSession(user)
    session.userAgent = 'testybrowser'
    await (<EntityManager>app.context.em).persistAndFlush(session)

    await request(app.callback())
      .post(`${baseUrl}/logout`)
      .set('user-agent', 'testybrowser')
      .auth(token, { type: 'bearer' })
      .expect(204)

    const sessions = await (<EntityManager>app.context.em).getRepository(UserSession).find({ user })
    expect(sessions).toHaveLength(0)
  })
})
