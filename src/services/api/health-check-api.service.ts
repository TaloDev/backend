import { Response, Request, Routes } from 'koa-clay'
import APIService from './api-service'

@Routes([
  {
    method: 'GET'
  }
])
export default class HealthCheckAPIService extends APIService {
  async index(req: Request): Promise<Response> {
    console.log(req.ctx.state.continuityDate)

    return {
      status: 200
    }
  }
}
