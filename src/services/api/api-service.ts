import { Service, ServiceRequest, ServiceResponse } from 'koa-rest-services'
import { Context } from 'koa'
import APIKey from '../../entities/api-key'
import getAPIKeyFromToken from '../../lib/auth/getAPIKeyFromToken'

export default class APIService<T> implements Service {
  serviceName: string

  constructor(serviceName: string) {
    this.serviceName = serviceName
  }

  async getAPIKey(ctx: Context): Promise<APIKey> {
    const key: APIKey = await getAPIKeyFromToken(ctx)
    return key
  }

  getService(ctx: Context): T {
    return ctx.services[this.serviceName]
  }

  forwardRequest(funcName: string, req: ServiceRequest): Promise<ServiceResponse> {
    const service = this.getService(req.ctx)
    const func = service[funcName]
    return func.call(service, req)
  }
}
