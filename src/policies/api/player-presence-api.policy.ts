import { PolicyResponse } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'
import Policy from '../policy'

export default class PlayerPresenceAPIPolicy extends Policy {
  async get(): Promise<PolicyResponse> {
    return this.hasScope(APIKeyScope.READ_PLAYER_PRESENCE)
  }

  async put(): Promise<PolicyResponse> {
    return this.hasScope(APIKeyScope.WRITE_PLAYER_PRESENCE)
  }
}
