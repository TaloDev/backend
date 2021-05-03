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

  beforeEach(async () => {
    const repo = (<EntityManager>app.context.em).getRepository(Event)
    const events = await repo.findAll()
    await repo.removeAndFlush(events)
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

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ events: [{ name: 'Craft bow', aliasId: validPlayer.aliases[0].id, timestamp: Date.now() }] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const event = await (<EntityManager>app.context.em).getRepository(Event).findOne({ name: 'Craft bow'})
    expect(event).toBeTruthy()
  })

  it('should create multiple events if the scope is valid', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({
        events: [
          { name: 'Craft bow', aliasId: validPlayer.aliases[0].id, timestamp: Date.now() },
          { name: 'Equip bow', aliasId: validPlayer.aliases[0].id, timestamp: Date.now(), props: [{ key: 'itemId', value: 5 }] },
          { name: 'Shoot arrow', aliasId: validPlayer.aliases[0].id, timestamp: Date.now() }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(3)
  })

  it('should not create an event if the scope is invalid', async () => {
    apiKey.scopes = []
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ events: [{ name: 'Craft bow', aliasId: validPlayer.aliases[0].id, timestamp: Date.now() }]})
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create an event if the alias is a string', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ events: [{ name: 'Craft bow', aliasId: 'blah', timestamp: Date.now() }]})
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.errors[0]).toStrictEqual(['No alias was found for aliasId blah'])
  })

  it('should not create an event if the alias doesn\'t exist', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ events: [{ name: 'Craft bow', aliasId: 574, timestamp: Date.now() }]})
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.errors[0]).toStrictEqual(['No alias was found for aliasId 574'])
  })

  it('should not create an event if the alias belongs to a player from another game', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const otherGame = await new GameFactory(apiKey.game.organisation).one()
    const invalidPlayer = await new PlayerFactory([otherGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush(invalidPlayer)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ events: [{ name: 'Craft bow', aliasId: invalidPlayer.aliases[0].id, timestamp: Date.now() }] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.errors[0]).toStrictEqual([`No alias was found for aliasId ${invalidPlayer.aliases[0].id}`])
  })

  it('should not create an event if the name is missing', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ events: [{ aliasId: validPlayer.aliases[0].id, timestamp: Date.now() }]})
      .auth(token, { type: 'bearer' })
      .expect(300)

    expect(res.body.errors[0]).toStrictEqual(['Event is missing the key: name'])
  })

  it('should not create an event if the timestamp is missing', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ events: [{ name: 'Craft bow', aliasId: validPlayer.aliases[0].id }]})
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.errors[0]).toStrictEqual(['Event is missing the key: timestamp'])
  })

  it('should not create any events if the events body key is not an array', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ name: 'Craft bow', aliasId: validPlayer.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body.message).toBe('Events must be an array')
  })

  it('should sanitise event props into strings', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({
        events: [
          { name: 'Equip bow', aliasId: validPlayer.aliases[0].id, timestamp: Date.now(), props: [{ key: 'itemId', value: 5 }] }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events[0].props[0].key).toBe('itemId')
    expect(res.body.events[0].props[0].value).toBe('5')
  })

  it('should delete null event props', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({
        events: [
          { name: 'Equip bow', aliasId: validPlayer.aliases[0].id, timestamp: Date.now(), props: [{ key: 'itemId', value: 5 }, { key: 'name', value: null }] }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events[0].props).toHaveLength(1)
  })

  it('should capture an error if the event props are not an array', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_EVENTS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({
        events: [
          { name: 'Equip bow', aliasId: validPlayer.aliases[0].id, timestamp: Date.now(), props: { itemId: 5 } }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

      expect(res.body.errors[0]).toStrictEqual(['Props must be an array'])
  })
})
