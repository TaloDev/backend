import request from 'supertest'

describe('Health check - get', () => {
  it('should return a 204', async () => {
    await request(app).get('/public/health').expect(204)
  })

  it('should return a 200 with a body if body=1', async () => {
    const res = await request(app).get('/public/health?body=1')

    expect(res.status).toBe(200)
    expect(res.text).toBe('OK')
  })
})
