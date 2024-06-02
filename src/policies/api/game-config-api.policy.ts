import Policy from '../policy.js'
import { PolicyResponse } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key.js'

export default class GameConfigAPIPolicy extends Policy {
  async index(): Promise<PolicyResponse> {
    return await this.hasScope(APIKeyScope.READ_GAME_CONFIG)
  }
}
