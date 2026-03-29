import assert from 'node:assert'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import GameChannelStorageProp from '../../../../src/entities/game-channel-storage-prop'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import GameChannelStoragePropFactory from '../../../fixtures/GameChannelStoragePropFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Game channel API - get storage', () => {
  it('should return a storage prop from redis if it exists in the cache', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persist([channel, player]).flush()

    const prop = await new GameChannelStoragePropFactory(channel).one()
    await em.persist(prop).flush()
    await GameChannelStorageProp.persistToRedis({
      redis,
      channelId: channel.id,
      key: prop.key,
      props: [prop],
    })

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage`)
      .query({ propKey: prop.key })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.prop.key).toBe(prop.key)
    expect(res.body.prop.value).toBe(prop.value)
    expect(res.body.prop.createdBy.id).toBe(prop.createdBy.id)
    expect(res.body.prop.lastUpdatedBy.id).toBe(prop.lastUpdatedBy.id)
  })

  it('should return a storage prop if it exists', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])

    const prop = await new GameChannelStoragePropFactory(channel)
      .state(() => ({ key: 'testKey' }))
      .one()
    await em.persist([channel, player, prop]).flush()

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage`)
      .query({ propKey: 'testKey' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.prop.key).toBe(prop.key)
    expect(res.body.prop.value).toBe(prop.value)
  })

  it('should return null if the prop does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persist([channel, player]).flush()

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage`)
      .query({ propKey: 'nonExistentKey' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.prop).toBeNull()
  })

  it('should return all rows for a prop array key', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])

    const prop1 = await new GameChannelStoragePropFactory(channel)
      .state(() => ({
        key: 'items[]',
        value: 'sword',
        createdBy: player.aliases[0],
        lastUpdatedBy: player.aliases[0],
      }))
      .one()
    const prop2 = await new GameChannelStoragePropFactory(channel)
      .state(() => ({
        key: 'items[]',
        value: 'shield',
        createdBy: player.aliases[0],
        lastUpdatedBy: player.aliases[0],
      }))
      .one()
    await em.persist([channel, player, prop1, prop2]).flush()

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage`)
      .query({ propKey: 'items[]' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.prop.key).toBe('items[]')
    expect(JSON.parse(res.body.prop.value).sort()).toStrictEqual(['shield', 'sword'])
  })

  it('should return a single-element array prop as a JSON array', async () => {
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
      .get(`/v1/game-channels/${channel.id}/storage`)
      .query({ propKey: 'items[]' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.prop.key).toBe('items[]')
    expect(JSON.parse(res.body.prop.value)).toStrictEqual(['sword'])
  })

  it('should return prop arrays from redis if available', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])

    const prop1 = await new GameChannelStoragePropFactory(channel)
      .state(() => ({
        key: 'items[]',
        value: 'sword',
        createdBy: player.aliases[0],
        lastUpdatedBy: player.aliases[0],
      }))
      .one()
    const prop2 = await new GameChannelStoragePropFactory(channel)
      .state(() => ({
        key: 'items[]',
        value: 'shield',
        createdBy: player.aliases[0],
        lastUpdatedBy: player.aliases[0],
      }))
      .one()
    await em.persist([channel, player, prop1, prop2]).flush()

    // first request populates the cache
    await request(app)
      .get(`/v1/game-channels/${channel.id}/storage`)
      .query({ propKey: 'items[]' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    // verify the flattened prop is cached
    const cachedValue = await redis.get(GameChannelStorageProp.getRedisKey(channel.id, 'items[]'))
    assert(cachedValue)

    const parsed = JSON.parse(cachedValue)
    expect(parsed.key).toBe('items[]')
    expect(JSON.parse(parsed.value).sort()).toStrictEqual(['shield', 'sword'])

    // second request should come from cache
    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage`)
      .query({ propKey: 'items[]' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.prop.key).toBe('items[]')
    expect(JSON.parse(res.body.prop.value).sort()).toStrictEqual(['shield', 'sword'])
  })

  it('should not return a storage prop if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persist([channel, player]).flush()

    const prop = await new GameChannelStoragePropFactory(channel).one()
    await em.persist(prop).flush()

    await request(app)
      .get(`/v1/game-channels/${channel.id}/storage`)
      .query({ propKey: 'testKey' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should not return a storage prop if the player is not a member of the channel', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const nonMember = await new PlayerFactory([apiKey.game]).one()
    channel.owner = (await new PlayerFactory([apiKey.game]).one()).aliases[0]
    await em.persist([channel, nonMember]).flush()

    const prop = await new GameChannelStoragePropFactory(channel).one()
    await em.persist(prop).flush()

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage`)
      .query({ propKey: 'testKey' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(nonMember.aliases[0].id))
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'This player is not a member of the channel' })
  })

  it('should return a 404 if the channel does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .get('/v1/game-channels/999999/storage')
      .query({ propKey: 'testKey' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Channel not found' })
  })

  it('should return a 404 if the player does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage`)
      .query({ propKey: 'testKey' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '999999')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
