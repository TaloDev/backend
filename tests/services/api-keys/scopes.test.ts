import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import { APIKeyScope } from '../../../src/entities/api-key'
import UserFactory from '../../fixtures/UserFactory'

const baseUrl = '/api-keys'

describe('API keys service - get scopes', () => {
  let app: Koa
  let user: User
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('admin').one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of api key scopes', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}/scopes`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    const length = Object.keys(res.body.scopes).reduce((acc, curr) => {
      return acc + res.body.scopes[curr].length
    }, 0)
    expect(length).toBe(Object.keys(APIKeyScope).length)
  })
})
