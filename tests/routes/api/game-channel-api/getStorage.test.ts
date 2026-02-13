import request from 'supertest'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameChannelStoragePropFactory from '../../../fixtures/GameChannelStoragePropFactory'

describe('Game channel API service - getStorage', () => {
  it('should return a storage prop from Redis if it exists in the cache', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush([channel, player])

    const prop = await new GameChannelStoragePropFactory(channel).one()
    await em.persistAndFlush(prop)
    await prop.persistToRedis(redis)

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

    const prop = await new GameChannelStoragePropFactory(channel).state(() => ({ key: 'testKey' })).one()
    await em.persistAndFlush([channel, player, prop])

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
    await em.persistAndFlush([channel, player])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage`)
      .query({ propKey: 'nonExistentKey' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.prop).toBeNull()
  })

  it('should not return a storage prop if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush([channel, player])

    const prop = await new GameChannelStoragePropFactory(channel).one()
    await em.persistAndFlush(prop)

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
    await em.persistAndFlush([channel, nonMember])

    const prop = await new GameChannelStoragePropFactory(channel).one()
    await em.persistAndFlush(prop)

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
    await em.persistAndFlush(player)

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
    await em.persistAndFlush(channel)

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/storage`)
      .query({ propKey: 'testKey' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '999999')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
