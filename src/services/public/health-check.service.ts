import { Response, Route, Service } from 'koa-clay'

export default class HealthCheckService extends Service {
  @Route({
    method: 'GET'
  })
  async index(): Promise<Response> {
    return {
      status: 204
    }
  }
}
