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
    apiKey.game = new Game('Updraft')
    apiKey.createdByUser = new User()
    token = await createToken(apiKey)

    validPlayer = new Player()
    validPlayer.game = apiKey.game

    await (<EntityManager>app.context.em).persistAndFlush([apiKey, validPlayer])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return the player\'s events if the scope exists', async () => {
    const events: Event[] = [...new Array(3)].map(() => new Event('Open inventory'))
    validPlayer.events.add(...events)
    await (<EntityManager>app.context.em).persistAndFlush(validPlayer)

    apiKey.scopes = [APIKeyScope.READ_EVENTS]
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(3)
  })

  it('should not return the player\'s events if the scope does not exist', async () => {
    apiKey.scopes = []
    token = await createToken(apiKey)

    await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
