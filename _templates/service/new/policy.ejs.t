---
to: src/policies/<%= name %>s.policy.ts
---
import Policy from './policy'
import { ServicePolicyResponse, ServicePolicyDenial } from 'koa-rest-services'
import { UserType } from '../entities/user'

export default class <%= h.changeCase.pascal(name) %>sPolicy extends Policy {
  async get(): Promise<boolean> {
    return true
  }

  async post(): Promise<ServicePolicyResponse> {
    const user = await this.getUser()
    if (user.type === UserType.DEMO) return new ServicePolicyDenial({ message: 'Demo accounts cannot create <%= h.changeCase.noCase(name) %>s' })

    return true
  }
}
