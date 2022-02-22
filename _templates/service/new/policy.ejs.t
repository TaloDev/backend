---
to: src/policies/<%= name %>s.policy.ts
---
import Policy from './policy'
import { PolicyResponse, PolicyDenial } from 'koa-clay'
import { UserType } from '../entities/user'

export default class <%= h.changeCase.pascal(name) %>Policy extends Policy {
  async get(): Promise<PolicyResponse> {
    return true
  }

  async post(): Promise<PolicyResponse> {
    const user = await this.getUser()
    if (user.type === UserType.DEMO) return new PolicyDenial({ message: 'Demo accounts cannot create <%= h.changeCase.noCase(name) %>s' })

    return true
  }
}
