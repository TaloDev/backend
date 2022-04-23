import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User, { UserType } from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import InviteFactory from '../../fixtures/InviteFactory'
import GameFactory from '../../fixtures/GameFactory'

const baseUrl = '/organisations/current'

describe('Organisation service - current', () => {
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

  it('should return games, members and pending invites for the user\'s current organisation', async () => {
    const games = await new GameFactory(user.organisation).many(2)
    const otherUser = await new UserFactory().with(() => ({ organisation: user.organisation })).one()
    const invites = await new InviteFactory().construct(user.organisation).with(() => ({ invitedByUser: user })).many(3)
    await (<EntityManager>app.context.em).persistAndFlush([otherUser, ...games, ...invites])

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.games).toHaveLength(games.length)
    expect(res.body.members).toHaveLength(2)
    expect(res.body.pendingInvites).toHaveLength(invites.length)
  })

  it('should not return the organisation for dev users', async () => {
    user.type = UserType.DEV
    await (<EntityManager>app.context.em).flush()

    await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not return the organisation for demo users', async () => {
    user.type = UserType.DEMO
    await (<EntityManager>app.context.em).flush()

    await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
