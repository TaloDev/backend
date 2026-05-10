import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key.js'
import GameChannel from '../../../../src/entities/game-channel.js'
import GameChannelFactory from '../../../fixtures/GameChannelFactory.js'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken.js'

describe('Game channel API - list', () => {
  it('should return a list of game channels if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channels = await new GameChannelFactory(apiKey.game).many(10)
    await em.persist(channels).flush()

    const res = await request(app)
      .get('/v1/game-channels')
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    res.body.channels.forEach((item: GameChannel, idx: number) => {
      expect(item.id).toBe(channels[idx].id)
    })
  })

  it('should not return game channels if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const channels = await new GameChannelFactory(apiKey.game).many(10)
    await em.persist(channels).flush()

    await request(app)
      .get('/v1/game-channels')
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not return private channels', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const publicChannels = await new GameChannelFactory(apiKey.game).many(3)
    const privateChannels = await new GameChannelFactory(apiKey.game).private().many(1)
    await em.persist([...publicChannels, ...privateChannels]).flush()

    const res = await request(app)
      .get('/v1/game-channels')
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channels).toHaveLength(publicChannels.length)
  })
})
