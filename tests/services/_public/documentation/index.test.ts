import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src'
import request from 'supertest'

describe('Documentation service - index', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a demo user and then delete them', async () => {
    const res = await request(app.callback())
      .get('/public/docs')
      .expect(200)

    expect(res.body.docs).toBeTruthy()
  })
})
