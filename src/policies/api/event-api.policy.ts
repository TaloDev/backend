import { PolicyResponse } from 'koa-clay'
import Policy from '../policy'

export default class EventAPIPolicy extends Policy {
  async post(): Promise<PolicyResponse> {
    return await this.hasScope('write:events')
  }
}
