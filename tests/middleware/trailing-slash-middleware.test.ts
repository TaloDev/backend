import request from 'supertest'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'
import { APIKeyScope } from '../../src/entities/api-key'

describe('Trailing slash middleware', () => {
  it('should strip a trailing slash and route correctly', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])

    await request(app)
      .get('/v1/players/identify/')
      .auth(token, { type: 'bearer' })
      .expect(400)
  })

  it('should not affect paths without a trailing slash', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])

    await request(app)
      .get('/v1/players/identify')
      .auth(token, { type: 'bearer' })
      .expect(400)
  })
})
