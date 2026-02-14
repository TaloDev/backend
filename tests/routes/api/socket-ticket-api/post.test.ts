import request from 'supertest'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Socket ticket API  - post', () => {
  it('should return a valid socket ticket', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const res = await request(app)
      .post('/v1/socket-tickets')
      .auth(token, { type: 'bearer' })
      .expect(200)

    const payload = await redis.get(`socketTickets.${res.body.ticket}`)
    expect(payload).toBe(`${apiKey.id}:0`)
  })

  it('should return a valid dev build socket ticket', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const res = await request(app)
      .post('/v1/socket-tickets')
      .auth(token, { type: 'bearer' })
      .set('x-talo-dev-build', '1')
      .expect(200)

    const payload = await redis.get(`socketTickets.${res.body.ticket}`)
    expect(payload).toBe(`${apiKey.id}:1`)
  })
})
