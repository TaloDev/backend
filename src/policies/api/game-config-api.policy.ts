import Policy from '../policy'
import { PolicyResponse } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'

export default class GameConfigAPIPolicy extends Policy {
  async index(): Promise<PolicyResponse> {
    return await this.hasScope(APIKeyScope.READ_GAME_CONFIG)
  }
}
