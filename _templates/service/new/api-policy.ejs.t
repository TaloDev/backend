---
to: "<%= (typeof api !== 'undefined') ? `src/policies/api/${name}s-api.policy.ts` : null %>"
---
import Policy from '../policy'
import { PolicyResponse } from 'koa-clay'

export default class <%= h.changeCase.pascal(name) %>APIPolicy extends Policy {
  async post(): Promise<PolicyResponse> {
    return await this.hasScope('write:<%= h.changeCase.camel(name) %>s')
  }
}
