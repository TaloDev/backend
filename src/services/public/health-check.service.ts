import { Response, Route, Service } from 'koa-clay'
import { TraceService } from '../../lib/tracing/trace-service'

@TraceService()
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
