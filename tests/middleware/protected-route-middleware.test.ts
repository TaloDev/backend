import request from 'supertest'
import { sign } from '../../src/lib/auth/jwt'

describe('Protected route user middleware', () => {
  it('should reject requests when the user cannot be found', async () => {
    const token = await sign({ sub: 999999 }, process.env.JWT_SECRET!, { expiresIn: '15m' })

    await request(app).get('/users/me').auth(token, { type: 'bearer' }).expect(401)
  })
})
