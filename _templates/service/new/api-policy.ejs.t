---
to: "<%= (typeof api !== 'undefined') ? `src/policies/api/${name}s-api.policy.ts` : null %>"
---
import Policy from '../policy'
import { ServicePolicyResponse } from 'koa-rest-services'

export default class <%= h.changeCase.pascal(name) %>sAPIPolicy extends Policy {
  async post(): Promise<ServicePolicyResponse> {
    return await this.hasScope('write:<%= h.changeCase.camel(name) %>s')
  }
}
