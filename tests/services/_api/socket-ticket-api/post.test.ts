import request from 'supertest'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Socket ticket API service - post', () => {
  it('should return a valid socket ticket', async () => {
    const [, token] = await createAPIKeyAndToken([])

    const res = await request(global.app)
      .post('/v1/socket-tickets')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.ticket).toHaveLength(36)
  })
})
