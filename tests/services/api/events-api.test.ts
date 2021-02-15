import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import Player from '../../../src/entities/player'
import Game from '../../../src/entities/game'
import APIKey, { APIKeyScope } from '../../../src/entities/api-key'
import User from '../../../src/entities/user'
import { createToken } from '../../../src/services/api-keys.service'
import Event from '../../../src/entities/event'

const baseUrl = '/api/events'

describe('Events API service', () => {
  let app: Koa
  let validPlayer: Player
  let apiKey: APIKey
  let token: string

  beforeAll(async () => {
    app = await init()

    apiKey = new APIKey()
    apiKey.game = new Game('Uplift')
    apiKey.createdByUser = new User()
    token = await createToken(apiKey)

    validPlayer = new Player(apiKey.game)

    await (<EntityManager>app.context.em).persistAndFlush([apiKey, validPlayer])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return the game\'s events if the scope is valid', async () => {
    const events: Event[] = [...new Array(3)].map(() => new Event('Open inventory', validPlayer))
    await (<EntityManager>app.context.em).persistAndFlush(events)

    apiKey.scopes = [APIKeyScope.READ_EVENTS]
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(3)

    for (let event of res.body.events) {
      expect(event.playerId).toBe(validPlayer.id)
      expect(event.gameId).toBe(apiKey.game.id)
    }
  })

  it('should not return the game\'s events without the valid scope', async () => {
    const otherGame = new Game('Crawle')
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    apiKey.scopes = []
    token = await createToken(apiKey)

    await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should create an event if the scope is valid', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .send({ name: 'Craft bow', playerId: validPlayer.id })
      .expect(200)

    expect(res.body.event.gameId).toBe(apiKey.game.id)
  })

  it('should not create an event if the scope is valid', async () => {
    apiKey.scopes = []
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .send({ name: 'Craft bow', playerId: validPlayer.id })
      .expect(403)
  })
})
