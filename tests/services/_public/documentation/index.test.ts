import request from 'supertest'

describe('Documentation service - index', () => {
  it('should return api documentation', async () => {
    const res = await request(global.app)
      .get('/public/docs')
      .expect(200)

    expect(res.body.docs).toBeTruthy()
  })
})
