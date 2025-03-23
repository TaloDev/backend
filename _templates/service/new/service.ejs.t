---
to: src/services/<%= name %>.service.ts
---
import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Route, Validate } from 'koa-clay'
import <%= h.changeCase.pascal(name) %> from '../entities/<%= name %>'
import <%= h.changeCase.pascal(name) %>Policy from '../policies/<%= name %>.policy'

export default class <%= h.changeCase.pascal(name) %>Service extends Service {
  @Route({
    method: 'GET',
    path: '/:id'
  })
  @HasPermission(<%= h.changeCase.pascal(name) %>Policy, 'get')
  async get(req: Request): Promise<Response> {
    const { id } = req.params
    const em: EntityManager = req.ctx.em
    const <%= h.changeCase.camel(name) %> = await em.getRepository(<%= h.changeCase.pascal(name) %>).findOne(Number(id))

    return {
      status: 200,
      body: {
        <%= h.changeCase.camel(name) %>
      }
    }
  }

  @Route({
    method: 'POST'
  })
  @Validate({
    body: []
  })
  @HasPermission(<%= h.changeCase.pascal(name) %>Policy, 'post')
  async post(req: Request): Promise<Response> {
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
