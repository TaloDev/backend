import request from 'supertest'
import { APIKeyScope } from '../../src/entities/api-key'
import GameChannelFactory from '../fixtures/GameChannelFactory'
import PlayerFactory from '../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'

describe('GameChannel subscriber', () => {
  describe('cache invalidation on create', () => {
    it('should invalidate the channel search cache when a new channel is created', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([
        APIKeyScope.READ_GAME_CHANNELS,
        APIKeyScope.WRITE_GAME_CHANNELS,
      ])
      const player = await new PlayerFactory([apiKey.game]).one()
      await em.persistAndFlush([player])

      // populate the cache with empty list
      const res1 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.channels).toHaveLength(0)

      // create a channel - this should clear the cache
      await request(app)
        .post('/v1/game-channels')
        .send({ name: 'Test Channel' })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // should return the new channel (not cached empty list)
      const res2 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.channels).toHaveLength(1)
      expect(res2.body.channels[0].name).toBe('Test Channel')
    })

    it('should invalidate cache when multiple channels are created', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([
        APIKeyScope.READ_GAME_CHANNELS,
        APIKeyScope.WRITE_GAME_CHANNELS,
      ])
      const player = await new PlayerFactory([apiKey.game]).one()
      await em.persistAndFlush([player])

      // populate the cache with empty list
      const res1 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.channels).toHaveLength(0)

      // create first channel
      await request(app)
        .post('/v1/game-channels')
        .send({ name: 'Channel 1' })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // should show 1 channel
      const res2 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.channels).toHaveLength(1)

      // create second channel
      await request(app)
        .post('/v1/game-channels')
        .send({ name: 'Channel 2' })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // should show 2 channels
      const res3 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res3.body.channels).toHaveLength(2)
    })
  })

  describe('cache invalidation on update', () => {
    it('should invalidate cache when channel props are updated', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([
        APIKeyScope.READ_GAME_CHANNELS,
        APIKeyScope.WRITE_GAME_CHANNELS,
      ])
      const player = await new PlayerFactory([apiKey.game]).one()
      const channel = await new GameChannelFactory(apiKey.game)
        .state(() => ({
          owner: player.aliases[0],
          name: 'Test Channel',
        }))
        .one()
      channel.members.add(player.aliases[0])
      channel.setProps([{ key: 'level', value: '1' }])
      await em.persistAndFlush([player, channel])

      // populate cache
      const res1 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.channels).toHaveLength(1)
      expect(res1.body.channels[0].props).toHaveLength(1)
      expect(res1.body.channels[0].props[0].value).toBe('1')

      // update channel props
      await request(app)
        .put(`/v1/game-channels/${channel.id}`)
        .send({ props: [{ key: 'level', value: '5' }] })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // should return the updated props
      const res2 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.channels).toHaveLength(1)
      expect(res2.body.channels[0].props).toHaveLength(1)
      expect(res2.body.channels[0].props[0].value).toBe('5')
    })
  })

  describe('cache invalidation on delete', () => {
    it('should invalidate the channel search cache when a channel is deleted', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([
        APIKeyScope.READ_GAME_CHANNELS,
        APIKeyScope.WRITE_GAME_CHANNELS,
      ])
      const player = await new PlayerFactory([apiKey.game]).one()
      const channel = await new GameChannelFactory(apiKey.game)
        .state(() => ({ owner: player.aliases[0] }))
        .one()
      channel.members.add(player.aliases[0])
      await em.persistAndFlush([player, channel])

      // populate cache with the channel
      const res1 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.channels).toHaveLength(1)

      // delete the channel
      await request(app)
        .delete(`/v1/game-channels/${channel.id}`)
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(204)

      // should return empty list (not cached result)
      const res2 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.channels).toHaveLength(0)
    })

    it('should invalidate cache when auto-cleanup deletes a channel', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([
        APIKeyScope.READ_GAME_CHANNELS,
        APIKeyScope.WRITE_GAME_CHANNELS,
      ])
      const player = await new PlayerFactory([apiKey.game]).one()
      const channel = await new GameChannelFactory(apiKey.game)
        .state(() => ({
          owner: player.aliases[0],
          autoCleanup: true,
        }))
        .one()
      channel.members.add(player.aliases[0])
      await em.persistAndFlush([player, channel])

      // populate cache
      const res1 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.channels).toHaveLength(1)

      // leave the channel - this should auto-cleanup and delete it
      await request(app)
        .post(`/v1/game-channels/${channel.id}/leave`)
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(204)

      // should return empty list (channel was auto-deleted)
      const res2 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.channels).toHaveLength(0)
    })
  })

  describe('cache isolation by game', () => {
    it('should only invalidate cache for the affected game', async () => {
      const [apiKey1, token1] = await createAPIKeyAndToken([
        APIKeyScope.READ_GAME_CHANNELS,
        APIKeyScope.WRITE_GAME_CHANNELS,
      ])
      const [apiKey2, token2] = await createAPIKeyAndToken([
        APIKeyScope.READ_GAME_CHANNELS,
        APIKeyScope.WRITE_GAME_CHANNELS,
      ])

      const player1 = await new PlayerFactory([apiKey1.game]).one()
      const player2 = await new PlayerFactory([apiKey2.game]).one()

      const channel1 = await new GameChannelFactory(apiKey1.game)
        .state(() => ({ owner: player1.aliases[0] }))
        .one()
      const channel2 = await new GameChannelFactory(apiKey2.game)
        .state(() => ({ owner: player2.aliases[0] }))
        .one()

      channel1.members.add(player1.aliases[0])
      channel2.members.add(player2.aliases[0])

      await em.persistAndFlush([player1, player2, channel1, channel2])

      // cache both games
      const res1Game1 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player1.aliases[0].id))
        .auth(token1, { type: 'bearer' })
        .expect(200)

      const res1Game2 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player2.aliases[0].id))
        .auth(token2, { type: 'bearer' })
        .expect(200)

      expect(res1Game1.body.channels).toHaveLength(1)
      expect(res1Game2.body.channels).toHaveLength(1)

      // create a new channel in game 1
      await request(app)
        .post('/v1/game-channels')
        .send({ name: 'New Channel' })
        .auth(token1, { type: 'bearer' })
        .set('x-talo-alias', String(player1.aliases[0].id))
        .expect(200)

      // game 1 cache should be invalidated
      const res2Game1 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player1.aliases[0].id))
        .auth(token1, { type: 'bearer' })
        .expect(200)

      expect(res2Game1.body.channels).toHaveLength(2)

      // game 2 should still have the same data (cache not affected)
      const res2Game2 = await request(app)
        .get('/v1/game-channels')
        .set('x-talo-alias', String(player2.aliases[0].id))
        .auth(token2, { type: 'bearer' })
        .expect(200)

      expect(res2Game2.body.channels).toHaveLength(1)
    })
  })
})
