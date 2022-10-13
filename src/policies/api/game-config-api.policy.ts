import Policy from '../policy'
import { PolicyResponse } from 'koa-clay'

export default class GameConfigAPIPolicy extends Policy {
  async index(): Promise<PolicyResponse> {
    return await this.hasScope('read:gameConfig')
  }
}
