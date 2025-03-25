---
to: "<%= (typeof api !== 'undefined') ? `src/services/api/${name}-api.service.ts` : null %>"
---
import { HasPermission, Request, Response, Route, ForwardTo, forwardRequest } from 'koa-clay'
import <%= h.changeCase.pascal(name) %>APIPolicy from '../../policies/api/<%= name %>-api.policy'
import APIService from './api-service'
import APIKey from '../../entities/api-key'

export default class <%= h.changeCase.pascal(name) %>APIService extends APIService {
  @Route({
    method: 'POST'
  })
  @HasPermission(<%= h.changeCase.pascal(name) %>APIPolicy, 'post')
  @ForwardTo('<%= h.changeCase.dot(name) %>', 'post')
  async post(req: Request): Promise<Response> {
    const key: APIKey = await this.getAPIKey(req.ctx)
    return await forwardRequest(req, {
      params: {
        gameId: key.game.id.toString()
      }
    })
  }
}
