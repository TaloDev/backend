---
to: tests/services/<%= name %>/get.test.ts
---
import request from 'supertest'
import createUserAndToken from '../../utils/createUserAndToken'
import <%= h.changeCase.pascal(name) %>Factory from '../../fixtures/<%= h.changeCase.pascal(name) %>Factory'
import { EntityManager } from '@mikro-orm/mysql'

describe('<%= h.changeCase.sentenceCase(name) %> service - get', () => {
  it('should return a of <%= h.changeCase.noCase(name) %>s', async () => {
    const [token] = await createUserAndToken()
    const <%= h.changeCase.camel(name) %> = await new <%= h.changeCase.pascal(name) %>Factory().one()
    await (<EntityManager>global.em).persistAndFlush(<%= h.changeCase.camel(name) %>)

    await request(global.app)
      .get(`/<%= name %>/${<%= h.changeCase.camel(name) %>.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)
  })
})
