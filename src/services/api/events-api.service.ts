import { ServiceRequest, ServiceResponse } from 'koa-rest-services'
import EventsService from '../events.service'
import APIService from './api-service'

export default class EventsAPIService extends APIService {
  constructor(serviceName: string) {
    super(serviceName)
  }

  async post(req: ServiceRequest): Promise<ServiceResponse> {
    return await this.getService<EventsService>(req).post(req)
  }

  async get(req: ServiceRequest): Promise<ServiceResponse> {
    return await this.getService<EventsService>(req).get(req)
  }
}
