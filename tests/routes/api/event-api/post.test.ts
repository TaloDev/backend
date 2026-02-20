import { Collection } from '@mikro-orm/mysql'
import { randText } from '@ngneat/falso'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import Event from '../../../../src/entities/event'
import PlayerProp from '../../../../src/entities/player-prop'
import { FlushEventsQueueHandler } from '../../../../src/lib/queues/game-metrics/flush-events-queue-handler'
import GameFactory from '../../../fixtures/GameFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Event API - post', () => {
  it('should create an event if the scope is valid', async () => {
    const addSpy = vi.spyOn(FlushEventsQueueHandler.prototype, 'add')

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({ events: [{ name: 'Craft bow', timestamp: Date.now() }] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.events).toHaveLength(1)
    expect(res.body.events[0].name).toBe('Craft bow')
    expect(res.body.events[0].playerAlias.id).toBe(player.aliases[0].id)

    expect(addSpy).toHaveBeenCalledOnce()
    const [arg]: [Event] = addSpy.mock.calls[0]
    const insertable = arg.toInsertable()

    expect(insertable.name).toBe('Craft bow')
    expect(insertable.player_alias_id).toBe(player.aliases[0].id)
  })

  it('should create multiple events if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({
        events: [
          { name: 'Craft bow', timestamp: Date.now() },
          { name: 'Equip bow', timestamp: Date.now(), props: [{ key: 'itemId', value: 5 }] },
          { name: 'Shoot arrow', timestamp: Date.now() },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.events).toHaveLength(3)
  })

  it('should not create an event if the scope is invalid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .post('/v1/events')
      .send({ events: [{ name: 'Craft bow', timestamp: Date.now() }] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it("should not create an event if the alias doesn't exist", async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])

    const res = await request(app)
      .post('/v1/events')
      .send({ events: [{ name: 'Craft bow', timestamp: Date.now() }] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '574')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not create an event if the alias belongs to a player from another game', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const otherGame = await new GameFactory(apiKey.game.organisation).one()
    const invalidPlayer = await new PlayerFactory([otherGame]).one()
    await em.persistAndFlush([invalidPlayer])

    const res = await request(app)
      .post('/v1/events')
      .send({ events: [{ name: 'Craft bow', timestamp: Date.now() }] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(invalidPlayer.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not create an event if the name is missing', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({ events: [{ timestamp: Date.now() }] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.errors[0]).toStrictEqual(['Event is missing the key: name'])
  })

  it('should not create an event if the timestamp is missing', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({ events: [{ name: 'Craft bow' }] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.errors[0]).toStrictEqual(['Event is missing the key: timestamp (Craft bow)'])
  })

  it('should not create any events if the events body key is not an array', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({ name: 'Craft bow' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        events: ['Invalid input: expected array, received undefined'],
      },
    })
  })

  it('should sanitise event props into strings', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({
        events: [
          { name: 'Equip bow', timestamp: Date.now(), props: [{ key: 'itemId', value: 5 }] },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.events[0].props[0].key).toBe('itemId')
    expect(res.body.events[0].props[0].value).toBe('5')
  })

  it('should delete null event props', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({
        events: [
          {
            name: 'Equip bow',
            timestamp: Date.now(),
            props: [
              { key: 'itemId', value: 5 },
              { key: 'name', value: null },
            ],
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.events[0].props).toHaveLength(1)
  })

  it('should not delete event props with values that are empty strings', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({
        events: [
          { name: 'Equip bow', timestamp: Date.now(), props: [{ key: 'itemId', value: '' }] },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.events[0].props[0].key).toBe('itemId')
    expect(res.body.events[0].props[0].value).toBe('')
  })

  it('should capture an error if the event props are not an array', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({
        events: [{ name: 'Equip bow', timestamp: Date.now(), props: { itemId: 5 } }],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.errors[0]).toStrictEqual(['Props must be an array (Equip bow)'])
  })

  it("should add valid meta props to the player's props", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .post('/v1/events')
      .send({
        events: [
          { name: 'Equip bow', timestamp: Date.now(), props: [{ key: 'META_OS', value: 'macOS' }] },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    const prop = await em.getRepository(PlayerProp).findOne({
      player: player.id,
      key: 'META_OS',
      value: 'macOS',
    })
    expect(prop).toBeTruthy()
  })

  it("should strip out event props that start with META_ but aren't in the meta props list", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({
        events: [
          {
            name: 'Equip bow',
            timestamp: Date.now(),
            props: [
              { key: 'META_NO_WAY', value: 'true' },
              { key: 'META_OS', value: 'macOS' },
            ],
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.events[0].props).toContainEqual({ key: 'META_OS', value: 'macOS' })
    expect(res.body.events[0].props).not.toContainEqual({ key: 'META_NO_WAY', value: 'true' })
  })

  it('should update meta props instead of creating new ones', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [new PlayerProp(player, 'META_OS', 'Windows')]),
      }))
      .one()
    await em.persistAndFlush(player)

    await request(app)
      .post('/v1/events')
      .send({
        events: [
          { name: 'Equip bow', timestamp: Date.now(), props: [{ key: 'META_OS', value: 'macOS' }] },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    const prop = await em.getRepository(PlayerProp).findOne({
      player: player.id,
      key: 'META_OS',
      value: 'macOS',
    })
    expect(prop).toBeTruthy()
  })

  it('should reject props where the key is greater than 128 characters', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({
        events: [
          {
            name: 'Equip bow',
            timestamp: Date.now(),
            props: [{ key: randText({ charCount: 129 }), value: '1' }],
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body).toStrictEqual({
      events: [],
      errors: [['Prop key length (129) exceeds 128 characters (Equip bow)']],
    })
  })

  it('should reject props where the value is greater than 512 characters', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({
        events: [
          {
            name: 'Equip bow',
            timestamp: Date.now(),
            props: [{ key: 'bio', value: randText({ charCount: 513 }) }],
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body).toStrictEqual({
      events: [],
      errors: [['Prop value length (513) exceeds 512 characters (Equip bow)']],
    })
  })

  it('should capture an error if the event timestamp is invalid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({
        events: [{ name: 'Equip bow', timestamp: ' ', props: [] }],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.errors[0]).toStrictEqual(['Event timestamp is invalid (Equip bow)'])
  })

  it('should de-duplicate events', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/events')
      .send({
        events: [
          { name: 'Craft bow', timestamp: Date.now() },
          { name: 'Craft bow', timestamp: Date.now() },
          { name: 'Craft bow', timestamp: Date.now() },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.events).toHaveLength(1)
    expect(res.body.errors[0]).toStrictEqual([])
    expect(res.body.errors[1]).toStrictEqual(['Duplicate event detected (Craft bow)'])
    expect(res.body.errors[2]).toStrictEqual(['Duplicate event detected (Craft bow)'])
  })
})
