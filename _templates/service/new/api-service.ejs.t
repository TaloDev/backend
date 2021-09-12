---
to: src/services/api/<%= name %>-api.service.ts
---
import { HasPermission, ServiceRequest, ServiceResponse } from 'koa-rest-services'
import <%= h.changeCase.pascal(name) %>APIPolicy from '../../policies/api/<%= name %>-api.policy'
import <%= h.changeCase.pascal(name) %>Service from '../<%= name %>.service'
import APIService from './api-service'
import APIKey from '../../entities/api-key'

export default class <%= h.changeCase.pascal(name) %>APIService extends APIService<<%= h.changeCase.pascal(name) %>Service> {
  constructor() {
    super(<%= name %>)
  }

  @HasPermission(<%= h.changeCase.pascal(name) %>APIPolicy, 'post')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const key: APIKey = await this.getAPIKey(req.ctx)
    req.body = {
      ...req.body,
      gameId: key.game.id
    }

    return await this.forwardRequest('post', req)
  }
}
