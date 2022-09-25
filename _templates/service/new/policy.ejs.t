---
to: src/policies/<%= name %>.policy.ts
---
import Policy from './policy'
import { PolicyResponse } from 'koa-clay'
import { UserType } from '../entities/user'
import UserTypeGate from './user-type-gate'

export default class <%= h.changeCase.pascal(name) %>Policy extends Policy {
  async get(): Promise<PolicyResponse> {
    return true
  }

  @UserTypeGate([UserType.ADMIN, UserType.DEV], 'create <%= h.inflection.humanize(name, true) %>')
  async post(): Promise<PolicyResponse> {
    return true
  }
}
