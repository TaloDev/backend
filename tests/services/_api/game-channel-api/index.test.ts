import request from 'supertest'
import { EntityManager } from '@mikro-orm/mysql'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import GameChannel from '../../../../src/entities/game-channel'

describe('Game channel API service - index', () => {
  it('should return a list of game channels if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channels = await new GameChannelFactory(apiKey.game).many(10)
    await (<EntityManager>global.em).persistAndFlush(channels)

    const res = await request(global.app)
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
    await (<EntityManager>global.em).persistAndFlush(channels)

    await request(global.app)
      .get('/v1/game-channels')
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
