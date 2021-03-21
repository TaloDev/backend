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
import EventFactory from '../../fixtures/EventFactory'

const baseUrl = '/api/events'

describe('Events API service', () => {
  let app: Koa
  let validPlayer: Player
  let apiKey: APIKey
  let token: string

  beforeAll(async () => {
    app = await init()

    apiKey = new APIKey(new Game('Uplift'), new User())
    token = await createToken(apiKey)

    validPlayer = new Player(apiKey.game)

    await (<EntityManager>app.context.em).persistAndFlush([apiKey, validPlayer])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return the game\'s events if the scope is valid', async () => {
    const events: Event[] = await new EventFactory([validPlayer]).with((event) => ({
      name: 'Open inventory',
      createdAt: new Date('2021-01-01')
    })).many(3)

    await (<EntityManager>app.context.em).persistAndFlush(events)

    apiKey.scopes = [APIKeyScope.READ_EVENTS]
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ startDate: '2021-01-01', endDate: '2021-01-02' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events['Open inventory'][0].count).toBe(3)
  })

  it('should not return the game\'s events without the valid scope', async () => {
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
      .send({ name: 'Craft bow', playerId: validPlayer.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.event.gameId).toBe(apiKey.game.id)
  })

  it('should not create an event if the scope is valid', async () => {
    apiKey.scopes = []
    token = await createToken(apiKey)

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ name: 'Craft bow', playerId: validPlayer.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create an event if the player doesn\'t exist', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ name: 'Craft bow', playerId: 'blah' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body.message).toBe('Player not found')
  })
})
