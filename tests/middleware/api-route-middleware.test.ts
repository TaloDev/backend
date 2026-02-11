import request from 'supertest'
import createUserAndToken from '../utils/createUserAndToken'

describe('API route actor middleware', () => {
  it('should reject user tokens on API routes', async () => {
    const [token] = await createUserAndToken()

    await request(app)
      .get('/v1/players/identify')
      .auth(token, { type: 'bearer' })
      .expect(401)
  })
})
