import request from 'supertest'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken.js'

describe('Health check API - get', () => {
  it('should return a 204', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(app).get('/v1/health-check').auth(token, { type: 'bearer' }).expect(204)
  })

  it('should return a 200 with a body if body=1', async () => {
    const [, token] = await createAPIKeyAndToken([])

    const res = await request(app).get('/v1/health-check?body=1').auth(token, { type: 'bearer' })

    expect(res.status).toBe(200)
    expect(res.text).toBe('OK')
  })
})
