import request from 'supertest'

describe('Health check - index', () => {
  it('should return a 204', async () => {
    await request(app).get('/public/health').expect(204)
  })
})
