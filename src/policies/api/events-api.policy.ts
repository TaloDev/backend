import { ServicePolicyResponse } from 'koa-rest-services'
import Policy from '../policy'

export default class EventsAPIPolicy extends Policy {
  async index(): Promise<ServicePolicyResponse> {
    return await this.hasScope('read:events')
  }

  async post(): Promise<ServicePolicyResponse> {
    return await this.hasScope('write:events')
  }
}
