import { Service, Request, Response } from 'koa-clay'
import { Context } from 'koa'
import APIKey from '../../entities/api-key'
import { EntityManager } from '@mikro-orm/core'
import merge from 'lodash.merge'

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
    return ctx.state.services[this.serviceName]
  }

  forwardRequest(funcName: string, req: Request, extra?: Partial<Request>): Promise<Response> {
    const newRequest: Request = Object.assign({}, req)
    merge(newRequest, extra)

    const service = this.getService(newRequest.ctx)
    const func = service[funcName]
    return func.call(service, newRequest)
  }
}
