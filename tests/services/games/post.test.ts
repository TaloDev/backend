import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import Game from '../../../src/entities/game'
import UserFactory from '../../fixtures/UserFactory'

const baseUrl = '/games'

describe('Games service - post', () => {
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

  it('should create a game', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ name: 'Twodoors' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.game.name).toBe('Twodoors')

    const game = await (<EntityManager>app.context.em).getRepository(Game).findOne(res.body.game.id, ['organisation'])
    expect(game.organisation.id).toBe(user.organisation.id)
  })

  it('should not create a game if using a demo account', async () => {
    const demoUser = await new UserFactory().state('demo').one()
    await (<EntityManager>app.context.em).persistAndFlush(demoUser)

    const demoToken = await genAccessToken(demoUser)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ name: 'Twodoors' })
      .auth(demoToken, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Demo accounts cannot create games' })
  })
})
