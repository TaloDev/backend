import request from 'supertest'

describe('Documentation - list', () => {
  it('should return api documentation', async () => {
    const res = await request(app).get('/public/docs').expect(200)

    expect(res.body.docs).toBeTruthy()
  })
})
