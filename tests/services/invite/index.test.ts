import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User, { UserType } from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import InviteFactory from '../../fixtures/InviteFactory'

const baseUrl = '/invites'

describe('Invite service - index', () => {
  let app: Koa
  let user: User
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('admin').one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of invites', async () => {
    const invites = await new InviteFactory().construct(user.organisation).many(3)
    await (<EntityManager>app.context.em).persistAndFlush(invites)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.invites).toHaveLength(invites.length)
  })

  it('should not return invites for dev users', async () => {
    user.type = UserType.DEV
    await (<EntityManager>app.context.em).flush()

    await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not return invites for demo users', async () => {
    user.type = UserType.DEMO
    await (<EntityManager>app.context.em).flush()

    await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
