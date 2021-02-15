import { Service, ServiceRequest } from 'koa-rest-services'
import { Context } from 'koa'
import APIKey from '../../entities/api-key'
import getAPIKeyFromToken from '../../lib/auth/getAPIKeyFromToken'

export default class APIService implements Service {
  serviceName: string

  constructor(serviceName: string) {
    this.serviceName = serviceName
  }

  async getAPIKey(ctx: Context): Promise<APIKey> {
    const key: APIKey = await getAPIKeyFromToken(ctx)
    return key
  }

  getService<T>(req: ServiceRequest): T {
    return req.ctx.services[this.serviceName]
  }
}
