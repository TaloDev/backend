import request from 'supertest'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Health check API  - index', () => {
  it('should return a 204', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(app)
      .get('/v1/health-check')
      .auth(token, { type: 'bearer' })
      .expect(204)
  })
})
