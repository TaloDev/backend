import Policy from './policy'
import { PolicyResponse } from 'koa-clay'
import UserTypeGate from './user-type-gate'

export default class OrganisationPolicy extends Policy {
  @UserTypeGate([], 'update the organisation pricing plan')
  async createCheckoutSession(): Promise<PolicyResponse> {
    return true
  }

  @UserTypeGate([], 'update the organisation pricing plan')
  async confirmPlan(): Promise<PolicyResponse> {
    return true
  }

  @UserTypeGate([], 'update the organisation pricing plan')
  async createPortalSession(): Promise<PolicyResponse> {
    return true
  }

  @UserTypeGate([], 'view the organisation pricing plan usage')
  async usage(): Promise<PolicyResponse> {
    return true
  }

  @UserTypeGate([], 'view the organisation pricing plan')
  async organisationPlan(): Promise<PolicyResponse> {
    return true
  }
}
