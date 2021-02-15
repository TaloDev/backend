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
import EventResource from '../../../src/resources/event.resource'

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

  it('should return the player\'s events if the scope exists', async () => {
    const events: Event[] = [...new Array(3)].map(() => new Event('Open inventory', validPlayer))
    await (<EntityManager>app.context.em).persistAndFlush(events)

    apiKey.scopes = [APIKeyScope.READ_EVENTS]
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(3)

    for (let e of res.body.events) {
      expect(e.playerId).toStrictEqual(validPlayer.id)
    }
  })
})
