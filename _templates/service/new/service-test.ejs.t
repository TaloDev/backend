---
to: tests/services/<%= name %>s/get.test.ts
---
import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'

const baseUrl = '/<%= name %>s'

describe('<%= h.changeCase.sentenceCase(name) %>s service - get', () => {
  let app: Koa
  let user: User
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of <%= h.changeCase.noCase(name) %>s', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(200)
  })
})
