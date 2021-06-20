import Policy from '../policy'
import { ServicePolicyDenial } from 'koa-rest-services'

export default class EventsAPIPolicy extends Policy {
  async index(): Promise<boolean | ServicePolicyDenial> {
    return await this.hasScope('read:events')
  }

  async post(): Promise<boolean | ServicePolicyDenial> {
    return await this.hasScope('write:events')
  }
}
