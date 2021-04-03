import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import Player from '../../../src/entities/player'
import Game from '../../../src/entities/game'
import APIKey, { APIKeyScope } from '../../../src/entities/api-key'
import { createToken } from '../../../src/services/api-keys.service'
import Event from '../../../src/entities/event'
import EventFactory from '../../fixtures/EventFactory'
import UserFactory from '../../fixtures/UserFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import GameFactory from '../../fixtures/GameFactory'

const baseUrl = '/api/events'

describe('Events API service', () => {
  let app: Koa
  let validPlayer: Player
  let apiKey: APIKey
  let token: string

  beforeAll(async () => {
    app = await init()

    const user = await new UserFactory().one()
    apiKey = new APIKey(new Game('Uplift', user.organisation), user)
    token = await createToken(apiKey)

    validPlayer = await new PlayerFactory([apiKey.game]).one()

    await (<EntityManager>app.context.em).persistAndFlush([apiKey, validPlayer])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return the game\'s events if the scope is valid', async () => {
    const events: Event[] = await new EventFactory([validPlayer]).with(() => ({
      name: 'Open inventory',
      createdAt: new Date('2021-01-01')
    })).many(3)

    await (<EntityManager>app.context.em).persistAndFlush(events)

    apiKey.scopes = [APIKeyScope.READ_EVENTS]
    await (<EntityManager>app.context.em).flush()
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
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should create an event if the scope is valid', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ name: 'Craft bow', aliasId: validPlayer.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.event.gameId).toBe(apiKey.game.id)
  })

  it('should not create an event if the scope is invalid', async () => {
    apiKey.scopes = []
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ name: 'Craft bow', aliasId: validPlayer.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create an event if the game doesn\'t exist', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ name: 'Craft bow', aliasId: 'blah' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body.message).toBe('Player alias not found')
  })

  it('should not create an event if the alias belongs to a player from another game', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const otherGame = await new GameFactory(apiKey.game.organisation).one()
    const invalidPlayer = await new PlayerFactory([otherGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush([invalidPlayer])

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ name: 'Craft bow', aliasId: invalidPlayer.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
