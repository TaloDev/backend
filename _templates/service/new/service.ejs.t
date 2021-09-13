---
to: src/services/<%= name %>s.service.ts
---
import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import <%= h.changeCase.pascal(name) %> from '../entities/<%= name %>'
import <%= h.changeCase.pascal(name) %>sPolicy from '../policies/<%= name %>s.policy'

export default class <%= h.changeCase.pascal(name) %>sService implements Service {
  @Validate({
    query: ['<%= h.changeCase.camel(name) %>Id']
  })
  @HasPermission(<%= h.changeCase.pascal(name) %>sPolicy, 'get')
  async get(req: ServiceRequest): Promise<ServiceResponse> {
    const { <%= h.changeCase.camel(name) %>Id } = req.query
    const em: EntityManager = req.ctx.em
    const <%= h.changeCase.camel(name) %> = await em.getRepository(<%= h.changeCase.pascal(name) %>).findOne(Number(<%= h.changeCase.camel(name) %>Id))

    return {
      status: 200,
      body: {
        <%= h.changeCase.camel(name) %>
      }
    }
  }

  @Validate({
    body: []
  })
  @HasPermission(<%= h.changeCase.pascal(name) %>sPolicy, 'post')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const {} = req.body
    const em: EntityManager = req.ctx.em

    const <%= h.changeCase.camel(name) %> = new <%= h.changeCase.pascal(name) %>()
    await em.persistAndFlush(<%= h.changeCase.camel(name) %>)

    return {
      status: 200,
      body: {
        <%= h.changeCase.camel(name) %>
      }
    }
  }
}
