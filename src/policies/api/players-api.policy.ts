import { ServicePolicyResponse } from 'koa-rest-services'
import Policy from '../policy'

export default class PlayersAPIPolicy extends Policy {
  async index(): Promise<ServicePolicyResponse> {
    return await this.hasScope('read:players')
  }

  async post(): Promise<ServicePolicyResponse> {
    return await this.hasScope('write:players')
  }

  async identify(): Promise<ServicePolicyResponse> {
    return await this.hasScope('read:players')
  }

  async patch(): Promise<ServicePolicyResponse> {
    return await this.hasScope('write:players')
  }

  async merge(): Promise<ServicePolicyResponse> {
    return await this.hasScopes(['read:players', 'write:players'])
  }
}
