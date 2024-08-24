import request from 'supertest'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Health check API service - index', () => {
  it('should return a 200', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(global.app)
      .get('/v1/health-check')
      .auth(token, { type: 'bearer' })
      .expect(204)
  })
})
