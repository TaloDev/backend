import { Service, ServiceRequest } from 'koa-rest-services'

export default class APIService implements Service {
  serviceName: string

  constructor(serviceName: string) {
    this.serviceName = serviceName
  }

  getService<T>(req: ServiceRequest): T {
    return req.ctx.services[this.serviceName]
  }
}
