import { PolicyResponse } from 'koa-clay'
import Policy from '../policy'

export default class PlayerAPIPolicy extends Policy {
  async index(): Promise<PolicyResponse> {
    return await this.hasScope('read:players')
  }

  async post(): Promise<PolicyResponse> {
    return await this.hasScope('write:players')
  }

  async identify(): Promise<PolicyResponse> {
    return await this.hasScope('read:players')
  }

  async patch(): Promise<PolicyResponse> {
    return await this.hasScope('write:players')
  }

  async merge(): Promise<PolicyResponse> {
    return await this.hasScopes(['read:players', 'write:players'])
  }
}
