import { Service, Request, Response } from 'koa-clay'
import { Context } from 'koa'
import APIKey from '../../entities/api-key'
import { EntityManager } from '@mikro-orm/core'

export default class APIService<T> implements Service {
  serviceName: string

  constructor(serviceName: string) {
    this.serviceName = serviceName
  }

  async getAPIKey(ctx: Context): Promise<APIKey> {
    const key = await (<EntityManager>ctx.em).getRepository(APIKey).findOne(ctx.state.user.sub)
    return key
  }

  getService(ctx: Context): T {
    return ctx.services[this.serviceName]
  }

  forwardRequest(funcName: string, req: Request): Promise<Response> {
    const service = this.getService(req.ctx)
    const func = service[funcName]
    return func.call(service, req)
  }
}
