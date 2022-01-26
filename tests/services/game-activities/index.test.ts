import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import Game from '../../../src/entities/game'
import GameFactory from '../../fixtures/GameFactory'
import GameActivityFactory from '../../fixtures/GameActivityFactory'

const baseUrl = '/game-activities'

describe('Game activities service - index', () => {
  let app: Koa
  let user: User
  let game: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    game = await new GameFactory(user.organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush([user, game])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of game activities', async () => {
    const activities = await new GameActivityFactory([game], [user]).many(10)
    await (<EntityManager>app.context.em).persistAndFlush(activities)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: game.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.activities).toHaveLength(activities.length)
  })

  it('should not return a list of game activities for a game the user has no access to', async () => {
    const otherUser = await new UserFactory().one()
    const otherGame = await new GameFactory(otherUser.organisation).one()

    const activities = await new GameActivityFactory([otherGame], [otherUser]).many(10)
    await (<EntityManager>app.context.em).persistAndFlush(activities)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })
})
