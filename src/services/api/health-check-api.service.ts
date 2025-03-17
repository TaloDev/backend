import { Response, Route } from 'koa-clay'
import APIService from './api-service'

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
