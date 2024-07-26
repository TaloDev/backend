import { PolicyResponse } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'
import Policy from '../policy'

export default class PlayerAuthAPIPolicy extends Policy {
  async login(): Promise<PolicyResponse> {
    return await this.hasScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
  }

  async verify(): Promise<PolicyResponse> {
    return await this.hasScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
  }

  async register(): Promise<PolicyResponse> {
    return await this.hasScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
  }

  async logout(): Promise<PolicyResponse> {
    return await this.hasScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
  }

  async changePassword(): Promise<PolicyResponse> {
    return await this.hasScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
  }

  async changeEmail(): Promise<PolicyResponse> {
    return await this.hasScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
  }

  async forgotPassword(): Promise<PolicyResponse> {
    return await this.hasScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
  }

  async resetPassword(): Promise<PolicyResponse> {
    return await this.hasScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
  }

  async toggleVerification(): Promise<PolicyResponse> {
    return await this.hasScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
  }
}
