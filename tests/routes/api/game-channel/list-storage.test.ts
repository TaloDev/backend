import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import GameChannelStorageProp from '../../../../src/entities/game-channel-storage-prop'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import GameChannelStoragePropFactory from '../../../fixtures/GameChannelStoragePropFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Game channel API - list storage', () => {
  it('should return multiple storage props from redis if they exist in the cache', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persist([channel, player]).flush()

    const prop1 = await new GameChannelStoragePropFactory(channel)
      .state(() => ({ key: 'key1' }))
      .one()
    const prop2 = await new GameChannelStoragePropFactory(channel)
      .state(() => ({ key: 'key2' }))
      .one()
    await em.persist([prop1, prop2]).flush()
    await GameChannelStorageProp.persistToRedis({
      redis,
      channelId: channel.id,
      key: prop1.key,
      props: [prop1],
    })
    await GameChannelStorageProp.persistToRedis({
      redis,
      channelId: channel.id,
      key: prop2.key,
      props: [prop2],
    })

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

    const prop1 = await new GameChannelStoragePropFactory(channel)
      .state(() => ({ key: 'testKey1' }))
      .one()
    const prop2 = await new GameChannelStoragePropFactory(channel)
      .state(() => ({ key: 'testKey2' }))
      .one()
    await em.persist([channel, player, prop1, prop2]).flush()

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

    const cachedProp = await new GameChannelStoragePropFactory(channel)
      .state(() => ({ key: 'cached' }))
      .one()
    const dbProp = await new GameChannelStoragePropFactory(channel)
      .state(() => ({ key: 'fromdb' }))
      .one()
    await em.persist([channel, player, cachedProp, dbProp]).flush()

    await GameChannelStorageProp.persistToRedis({
      redis,
      channelId: channel.id,
      key: cachedProp.key,
      props: [cachedProp],
    })

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
    await em.persist([channel, player]).flush()

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

    const existingProp = await new GameChannelStoragePropFactory(channel)
      .state(() => ({ key: 'exists' }))
      .one()
    await em.persist([channel, player, existingProp]).flush()

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['exists', 'missing'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.props).toHaveLength(1)
    expect(res.body.props[0].key).toBe(existingProp.key)
  })

  it('should return all rows for prop array keys', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])

    const arrayProp1 = await new GameChannelStoragePropFactory(channel)
      .state(() => ({
        key: 'items[]',
        value: 'sword',
        createdBy: player.aliases[0],
        lastUpdatedBy: player.aliases[0],
      }))
      .one()
    const arrayProp2 = await new GameChannelStoragePropFactory(channel)
      .state(() => ({
        key: 'items[]',
        value: 'shield',
        createdBy: player.aliases[0],
        lastUpdatedBy: player.aliases[0],
      }))
      .one()
    const scalarProp = await new GameChannelStoragePropFactory(channel)
      .state(() => ({
        key: 'score',
        value: '42',
        createdBy: player.aliases[0],
        lastUpdatedBy: player.aliases[0],
      }))
      .one()
    await em.persist([channel, player, arrayProp1, arrayProp2, scalarProp]).flush()
    await GameChannelStorageProp.persistToRedis({
      redis,
      channelId: channel.id,
      key: scalarProp.key,
      props: [scalarProp],
    })

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['score', 'items[]'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.props).toHaveLength(3)

    const arrayResults = res.body.props.filter((p: { key: string }) => p.key === 'items[]')
    expect(arrayResults).toHaveLength(2)
    expect(arrayResults.map((p: { value: string }) => p.value).sort()).toStrictEqual([
      'shield',
      'sword',
    ])

    const scalarResult = res.body.props.find((p: { key: string }) => p.key === 'score')
    expect(scalarResult.value).toBe('42')
  })

  it('should return array props from redis if available', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])

    const arrayProp1 = await new GameChannelStoragePropFactory(channel)
      .state(() => ({
        key: 'items[]',
        value: 'sword',
        createdBy: player.aliases[0],
        lastUpdatedBy: player.aliases[0],
      }))
      .one()
    const arrayProp2 = await new GameChannelStoragePropFactory(channel)
      .state(() => ({
        key: 'items[]',
        value: 'shield',
        createdBy: player.aliases[0],
        lastUpdatedBy: player.aliases[0],
      }))
      .one()
    await em.persist([channel, player, arrayProp1, arrayProp2]).flush()

    // first request populates the cache
    await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['items[]'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    // verify the flattened array prop is cached
    const cachedValue = await redis.get(GameChannelStorageProp.getRedisKey(channel.id, 'items[]'))
    expect(cachedValue).not.toBeNull()
    const parsed = JSON.parse(cachedValue!)
    expect(parsed.key).toBe('items[]')
    expect(JSON.parse(parsed.value).sort()).toStrictEqual(['shield', 'sword'])

    // second request should come from cache
    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['items[]'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.props).toHaveLength(2)
    const values = res.body.props.map((p: { value: string }) => p.value).sort()
    expect(values).toStrictEqual(['shield', 'sword'])
    res.body.props.forEach((p: { key: string }) => expect(p.key).toBe('items[]'))
  })

  it('should return a single-element array prop as a single prop', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])

    const prop = await new GameChannelStoragePropFactory(channel)
      .state(() => ({
        key: 'items[]',
        value: 'sword',
        createdBy: player.aliases[0],
        lastUpdatedBy: player.aliases[0],
      }))
      .one()
    await em.persist([channel, player, prop]).flush()

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['items[]'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.props).toHaveLength(1)
    expect(res.body.props[0].key).toBe('items[]')
    expect(res.body.props[0].value).toBe('sword')
  })

  it('should reject requests with too many keys', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persist([channel, player]).flush()

    const tooManyKeys = Array.from({ length: 51 }, (_, i) => `key${i}`)

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: tooManyKeys })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: { propKeys: ['Maximum 50 keys allowed per request'] },
    })
  })

  it('should reject requests without prop keys', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persist([channel, player]).flush()

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: [] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        propKeys: ['propKeys is missing from the request query'],
      },
    })
  })

  it('should reject requests containing empty and invalid keys', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persist([channel, player]).flush()

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['validKey', '', null, 123] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        propKeys: ['All keys must be non-empty strings'],
      },
    })
  })

  it('should handle a single propKeys item', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])

    const prop = await new GameChannelStoragePropFactory(channel)
      .state(() => ({ key: 'singleKey' }))
      .one()
    await em.persist([channel, player, prop]).flush()

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
    await em.persist([channel, player]).flush()

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage/list`)
      .query({ propKeys: ['testKey'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'This player is not a member of the channel',
    })
  })

  it('should return 404 if the player does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    await em.persist([channel]).flush()

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
    await em.persist([player]).flush()

    const res = await request(app)
      .get('/v1/game-channels/999999/storage/list')
      .query({ propKeys: ['testKey'] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Channel not found' })
  })

})
