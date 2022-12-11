---
to: tests/services/<%= name %>/index.test.ts
---
import request from 'supertest'
import createUserAndToken from '../../utils/createUserAndToken'

describe('<%= h.changeCase.sentenceCase(name) %> service - index', () => {
  it('should return a list of <%= h.changeCase.noCase(name) %>s', async () => {
    const [token] = await createUserAndToken()

    await request(global.app)
      .get('/<%= name %>s')
      .auth(token, { type: 'bearer' })
      .expect(200)
  })
})
