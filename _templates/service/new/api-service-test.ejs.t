---
to: "<%= (typeof api !== 'undefined') ? `tests/services/_api/${name}-api/post.test.ts` : null %>"
---
import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('<%= h.changeCase.sentenceCase(name) %> API service - post', () => {
  it('should create a <%= h.changeCase.noCase(name) %> if the scope is valid', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_<%= h.changeCase.constantCase(name) %>S])

    await request(global.app)
      .post('/v1/<%= name %>s')
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should not create a <%= h.changeCase.noCase(name) %> if the scope is not valid', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(global.app)
      .post('/v1/<%= name %>s')
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
