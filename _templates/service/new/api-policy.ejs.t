---
to: src/policies/api/<%= name %>s-api.policy.ts
---
import Policy from '../policy'
import { ServicePolicyDenial } from 'koa-rest-services'

export default class <%= h.changeCase.pascal(name) %>sAPIPolicy extends Policy {
  async post(): Promise<boolean | ServicePolicyDenial> {
    return await this.hasScope('write:<%= name %>s')
  }
}