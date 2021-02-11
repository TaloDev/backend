import Koa from 'koa'
import init from '../src'
import request from 'supertest'

const baseUrl = '/public/users'

describe('Users public service', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  it('should register a user', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email: 'tudor@sleepystudios.net', password: 'password' })
      .set('user-agent', 'test')
  })
})
