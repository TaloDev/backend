import { PolicyResponse } from 'koa-clay'
import Policy from '../policy'

export default class EventAPIPolicy extends Policy {
  async index(): Promise<PolicyResponse> {
    return await this.hasScope('read:events')
  }

  async post(): Promise<PolicyResponse> {
    return await this.hasScope('write:events')
  }
}
