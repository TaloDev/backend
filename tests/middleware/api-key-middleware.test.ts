import request from 'supertest'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'
import APIKey from '../../src/entities/api-key'

describe('API key middleware', () => {
  it('should reject unknown api keys', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    await em.repo(APIKey).nativeDelete(apiKey)

    await request(app)
      .get('/v1/players/identify')
      .auth(token, { type: 'bearer' })
      .expect(401)
  })
})
