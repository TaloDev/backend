import { Response, Routes } from 'koa-clay'
import APIService from './api-service'

@Routes([
  {
    method: 'GET'
  }
])
export default class HealthCheckAPIService extends APIService {
  async index(): Promise<Response> {
    return {
      status: 204
    }
  }
}
