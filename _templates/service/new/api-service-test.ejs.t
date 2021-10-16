---
to: "<%= (typeof api !== 'undefined') ? `tests/services/_api/${name}s-api/post.test.ts` : null %>"
---
import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import APIKey, { APIKeyScope } from '../../../../src/entities/api-key'
import { createToken } from '../../../../src/services/api-keys.service'
import UserFactory from '../../../fixtures/UserFactory'
import GameFactory from '../../../fixtures/GameFactory'

const baseUrl = '/v1/<%= name %>s'

describe('<%= h.changeCase.sentenceCase(name) %>s API service - post', () => {
  let app: Koa
  let apiKey: APIKey
  let token: string

  beforeAll(async () => {
    app = await init()

    const user = await new UserFactory().one()
    const game = await new GameFactory(user.organisation).one()
    apiKey = new APIKey(game, user)
    token = await createToken(apiKey)

    await (<EntityManager>app.context.em).persistAndFlush(apiKey)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a <%= h.changeCase.noCase(name) %> if the scope is valid', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_<%= h.changeCase.constantCase(name) %>S]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .post(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should not create a <%= h.changeCase.noCase(name) %> if the scope is valid', async () => {
    apiKey.scopes = []
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .post(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
