---
to: tests/services/<%= name %>/get.test.ts
---
import request from 'supertest'
import createUserAndToken from '../../utils/createUserAndToken'
import <%= h.changeCase.pascal(name) %>Factory from '../../fixtures/<%= h.changeCase.pascal(name) %>Factory'

describe('<%= h.changeCase.sentenceCase(name) %> service - get', () => {
  it('should return a list of <%= h.changeCase.noCase(name) %>s', async () => {
    const [token] = await createUserAndToken()
    const <%= name %> = await new <%= h.changeCase.pascal(name) %>Factory().one()

    await request(global.app)
      .get(`/<%= name %>/<%= name %>.id`)
      .auth(token, { type: 'bearer' })
      .expect(200)
  })
})
