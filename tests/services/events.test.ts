import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../src/index'
import request from 'supertest'
import User from '../../src/entities/user'
import { genAccessToken } from '../../src/lib/auth/buildTokenPair'
import Game from '../../src/entities/game'
import Event from '../../src/entities/event'
import Player from '../../src/entities/player'

const baseUrl = '/events'

describe('Events service', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = new User()
    validGame = new Game('Uplift')
    validGame.teamMembers.add(user)
    await (<EntityManager>app.context.em).persistAndFlush(validGame)

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of events', async () => {
    const player = new Player(validGame)
    const events: Event[] = [...new Array(3)].map(() => new Event('Open inventory', player))
    await (<EntityManager>app.context.em).persistAndFlush(events)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(events.length)
  })

  it('should not return a list of events for a non-existent game', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: 8 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'The specified game doesn\'t exist' })
  })

  it('should not return a list of events for a game the user has no access to', async () => {
    const otherGame = new Game('Crawle')
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
