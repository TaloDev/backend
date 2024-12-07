import Policy from '../policy'
import { PolicyResponse } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'

export default class GameChannelAPIPolicy extends Policy {
  async index(): Promise<PolicyResponse> {
    return await this.hasScope(APIKeyScope.READ_GAME_CHANNELS)
  }

  async post(): Promise<PolicyResponse> {
    return await this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }

  async join(): Promise<PolicyResponse> {
    return await this.hasScope(APIKeyScope.READ_GAME_CHANNELS)
  }

  async leave(): Promise<PolicyResponse> {
    return await this.hasScope(APIKeyScope.WRITE_GAME_CHANNELS)
  }
}
