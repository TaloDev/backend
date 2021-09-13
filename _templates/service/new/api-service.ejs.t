---
to: src/services/api/<%= name %>s-api.service.ts
---
import { HasPermission, ServiceRequest, ServiceResponse } from 'koa-rest-services'
import <%= h.changeCase.pascal(name) %>sAPIPolicy from '../../policies/api/<%= name %>s-api.policy'
import <%= h.changeCase.pascal(name) %>sService from '../<%= name %>s.service'
import APIService from './api-service'
import APIKey from '../../entities/api-key'

export default class <%= h.changeCase.pascal(name) %>APIService extends APIService<<%= h.changeCase.pascal(name) %>sService> {
  constructor() {
    super('<%= name %>s')
  }

  @HasPermission(<%= h.changeCase.pascal(name) %>sAPIPolicy, 'post')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const key: APIKey = await this.getAPIKey(req.ctx)
    req.body = {
      ...req.body,
      gameId: key.game.id
    }

    return await this.forwardRequest('post', req)
  }
}
