import request from 'supertest'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'
import { APIKeyScope } from '../../src/entities/api-key'
import { sign } from '../../src/lib/auth/jwt'

describe('Protected route actor middleware', () => {
  it('should reject access when an API token is used on a protected route', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])

    await request(app)
      .get('/users/me')
      .auth(token, { type: 'bearer' })
      .expect(401)
  })

  it('should reject requests when the user cannot be found', async () => {
    const token = await sign({ sub: 999999 }, process.env.JWT_SECRET!, { expiresIn: '15m' })

    await request(app)
      .get('/users/me')
      .auth(token, { type: 'bearer' })
      .expect(401)
  })
})
