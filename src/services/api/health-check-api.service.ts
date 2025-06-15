import { Response, Route } from 'koa-clay'
import APIService from './api-service'
import { TraceService } from '../../lib/tracing/trace-service'

@TraceService()
export default class HealthCheckAPIService extends APIService {
  @Route({
    method: 'GET'
  })
  async index(): Promise<Response> {
    return {
      status: 204
    }
  }
}
