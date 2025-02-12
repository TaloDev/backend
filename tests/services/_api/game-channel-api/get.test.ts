import request from 'supertest'
import { EntityManager } from '@mikro-orm/mysql'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Game channel API service - get', () => {
  it('should return a game channel if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    await (<EntityManager>global.em).persistAndFlush(channel)

    const res = await request(global.app)
      .get(`/v1/game-channels/${channel.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channel.id).toBe(channel.id)
    expect(res.body.channel.name).toBe(channel.name)
  })

  it('should not return a game channel if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const channel = await new GameChannelFactory(apiKey.game).one()
    await (<EntityManager>global.em).persistAndFlush(channel)

    await request(global.app)
      .get(`/v1/game-channels/${channel.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should return 404 if the channel does not exist', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const res = await request(global.app)
      .get('/v1/game-channels/999999')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Channel not found' })
  })
})
