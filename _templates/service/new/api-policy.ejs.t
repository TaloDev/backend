---
to: "<%= (typeof api !== 'undefined') ? `src/policies/api/${name}-api.policy.ts` : null %>"
---
import Policy from '../policy'
import { PolicyResponse } from 'koa-clay'
import { APIKeyScope } from '../../entities/api-key'

export default class <%= h.changeCase.pascal(name) %>APIPolicy extends Policy {
  async post(): Promise<PolicyResponse> {
    return await this.hasScope(APIKeyScope.WRITE_<%= h.changeCase.constantCase(name) %>S)
  }
}
