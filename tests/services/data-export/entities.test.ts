import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'

const baseUrl = '/data-exports'

describe('Data export service - available entities', () => {
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

  it('should return a list of available data export entities', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}/entities`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entities).toStrictEqual([ 'events', 'players', 'playerAliases', 'leaderboardEntries', 'gameStats', 'playerGameStats' ])
  })
})
