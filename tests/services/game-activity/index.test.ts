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
import GameActivity from '../../../src/entities/game-activity'

const baseUrl = '/game-activities'

describe('Game activitie service - index', () => {
  let app: Koa
  let user: User
  let game: Game
  let activities: GameActivity[]
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('admin').one()
    game = await new GameFactory(user.organisation).one()
    activities = await new GameActivityFactory([game], [user]).many(5)
    await (<EntityManager>app.context.em).persistAndFlush([user, game, ...activities])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of game activities for an admin user', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: game.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.activities).toHaveLength(activities.length)
  })

  it('should not return a list of game activities for a dev user', async () => {
    const devUser = await new UserFactory().with(() => ({ organisation: game.organisation })).one()
    await (<EntityManager>app.context.em).persistAndFlush(devUser)
    const devToken = await genAccessToken(devUser)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: game.id })
      .auth(devToken, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You do not have permissions to view game activities' })
  })

  it('should return a list of game activities for a demo user', async () => {
    const demoUser = await new UserFactory().state('demo').with(() => ({ organisation: game.organisation })).one()
    await (<EntityManager>app.context.em).persistAndFlush(demoUser)
    const demoToken = await genAccessToken(demoUser)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: game.id })
      .auth(demoToken, { type: 'bearer' })
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
