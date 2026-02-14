import request from 'supertest'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameChannelStoragePropFactory from '../../../fixtures/GameChannelStoragePropFactory'

describe('Game channel API  - listStorage', () => {
  it('should return multiple storage props from Redis if they exist in the cache', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush([channel, player])

    const prop1 = await new GameChannelStoragePropFactory(channel).state(() => ({ key: 'key1' })).one()
    const prop2 = await new GameChannelStoragePropFactory(channel).state(() => ({ key: 'key2' })).one()
    await em.persistAndFlush([prop1, prop2])
    await prop1.persistToRedis(redis)
    await prop2.persistToRedis(redis)

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['key1', 'key2'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.props).toHaveLength(2)
    expect(res.body.props[0].key).toBe(prop1.key)
    expect(res.body.props[0].value).toBe(prop1.value)
    expect(res.body.props[1].key).toBe(prop2.key)
    expect(res.body.props[1].value).toBe(prop2.value)
  })

  it('should return storage props from database if they do not exist in cache', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])

    const prop1 = await new GameChannelStoragePropFactory(channel).state(() => ({ key: 'testKey1' })).one()
    const prop2 = await new GameChannelStoragePropFactory(channel).state(() => ({ key: 'testKey2' })).one()
    await em.persistAndFlush([channel, player, prop1, prop2])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['testKey1', 'testKey2'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.props).toHaveLength(2)
    expect(res.body.props[0].key).toBe(prop1.key)
    expect(res.body.props[0].value).toBe(prop1.value)
    expect(res.body.props[1].key).toBe(prop2.key)
    expect(res.body.props[1].value).toBe(prop2.value)
  })

  it('should return mixed results from cache and database', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])

    const cachedProp = await new GameChannelStoragePropFactory(channel).state(() => ({ key: 'cached' })).one()
    const dbProp = await new GameChannelStoragePropFactory(channel).state(() => ({ key: 'fromdb' })).one()
    await em.persistAndFlush([channel, player, cachedProp, dbProp])

    await cachedProp.persistToRedis(redis)

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['cached', 'fromdb'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.props).toHaveLength(2)
    expect(res.body.props[0].key).toBe(cachedProp.key)
    expect(res.body.props[0].value).toBe(cachedProp.value)
    expect(res.body.props[1].key).toBe(dbProp.key)
    expect(res.body.props[1].value).toBe(dbProp.value)
  })

  it('should return an empty array when requesting non-existent keys', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush([channel, player])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['nonExistent1', 'nonExistent2'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.props).toEqual([])
  })

  it('should return partial results when some keys exist and others do not', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])

    const existingProp = await new GameChannelStoragePropFactory(channel).state(() => ({ key: 'exists' })).one()
    await em.persistAndFlush([channel, player, existingProp])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['exists', 'missing'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.props).toHaveLength(1)
    expect(res.body.props[0].key).toBe(existingProp.key)
  })

  it('should reject requests with too many keys', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush([channel, player])

    const tooManyKeys = Array.from({ length: 51 }, (_, i) => `key${i}`)

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: tooManyKeys })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: { propKeys: ['Maximum 50 keys allowed per request'] }
    })
  })

  it('should reject requests without prop keys', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush([channel, player])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: [] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        propKeys: ['propKeys is missing from the request query']
      }
    })
  })

  it('should reject requests containing empty and invalid keys', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush([channel, player])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['validKey', '', null, 123] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        propKeys: ['All keys must be non-empty strings']
      }
    })
  })

  it('should handle a single propKeys item', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])

    const prop = await new GameChannelStoragePropFactory(channel).state(() => ({ key: 'singleKey' })).one()
    await em.persistAndFlush([channel, player, prop])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['singleKey'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.props).toHaveLength(1)
    expect(res.body.props[0].key).toBe(prop.key)
    expect(res.body.props[0].value).toBe(prop.value)
  })

  it('should return 403 if the player is not a member of the channel', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([channel, player])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['testKey'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'This player is not a member of the channel'
    })
  })

  it('should return 404 if the player does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    await em.persistAndFlush([channel])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['testKey'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '999999')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should return 404 if the channel does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player])

    const res = await request(app)
      .get('/v1/game-channels/999999/storage/list')
      .query({ propKeys: ['testKey'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Channel not found' })
  })
})
