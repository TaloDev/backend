import { Response } from 'koa-clay'
import APIService from './api-service'

export default class HealthCheckAPIService extends APIService {
  async index(): Promise<Response> {
    return {
      status: 204
    }
  }
}
