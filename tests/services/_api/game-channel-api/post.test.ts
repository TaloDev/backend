import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Game channel API service - post', () => {
  it('should create a game channel if the scope is valid', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    await request(global.app)
      .post('/v1/game-channels')
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should not create a game channel if the scope is not valid', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(global.app)
      .post('/v1/game-channels')
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
