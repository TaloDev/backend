import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import Game from '../../../src/entities/game'
import UserFactory from '../../fixtures/UserFactory'

const baseUrl = '/users'

describe('Users service - get me', () => {
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

  it('should return the user\'s data', async () => {
    const game = new Game('Vigilante 2084', user.organisation)
    await (<EntityManager>app.context.em).persistAndFlush(game)

    const res = await request(app.callback())
      .get(`${baseUrl}/me`)
      .auth(token, { type: 'bearer' })
      .expect(200)
    
    expect(res.body.user).toBeTruthy()
    expect(res.body.user.organisation).toBeTruthy()
    expect(res.body.user.organisation.games).toHaveLength(1)
    expect(res.body.user.organisation.games[0].name).toBe('Vigilante 2084')
  })
})
